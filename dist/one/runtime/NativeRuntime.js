/**
 * ONE Language — Foundational Native Runtime
 * ===========================================
 * Module: @one/runtime/NativeRuntime
 *
 * The authoritative native execution runtime for One Language.
 * Coordinates execution model, memory boundaries, value system,
 * error handling, and sandboxed native modules.
 *
 * Invariants:
 *   - Zero external LLM / cloud / network dependencies
 *   - Guaranteed determinism (sigma^2 = 0.0) across replay cycles
 *   - Physical RSS bounded under 512 MB via RSSGuard
 *   - Hardware fail-closed actuation lock (is_actuation_blocked: true)
 *   - Fully sandboxed: no child_process, no eval(), no host escape
 */
import { UnifiedCompiler } from '../UnifiedCompiler';
import { NativeExecutionModel } from './NativeExecutionModel';
import { NativeRuntimeState } from './NativeRuntimeState';
import { toRaw, fromRaw, createNull, createInt, createFloat, createI32, createF32, createString, createBool, createArray, createRecord, createClosure, isEqual, compare, } from './NativeValues';
import { OneNativeRuntimeError } from './NativeErrors';
import { NativeModuleRegistry } from './NativeModules';
import { DeterministicNumericOps } from '../types/TypedNumeric';
export class NativeRuntime {
    executionModel;
    runtimeState;
    moduleRegistry;
    compiler;
    instructions = [];
    pc = 0;
    output = [];
    labels = new Map();
    functions = new Map();
    loopCursors = new Map();
    constructor(options = {}) {
        this.executionModel = new NativeExecutionModel({
            maxInstructions: options.maxInstructions ?? 1_000_000,
            maxCallDepth: options.maxCallDepth ?? 512,
        });
        this.runtimeState = new NativeRuntimeState(options.maxRssMb ?? 512);
        this.moduleRegistry = new NativeModuleRegistry(options.spatialBridge);
        this.compiler = new UnifiedCompiler();
        // Populate standard library namespaces into globals
        this.moduleRegistry.populateGlobals(this.runtimeState.getGlobalsMap());
        this.executionModel.transition('READY');
    }
    getModuleRegistry() {
        return this.moduleRegistry;
    }
    getRuntimeState() {
        return this.runtimeState;
    }
    getExecutionModel() {
        return this.executionModel;
    }
    reset() {
        this.executionModel.reset();
        this.runtimeState.reset();
        this.moduleRegistry.populateGlobals(this.runtimeState.getGlobalsMap());
        this.instructions = [];
        this.pc = 0;
        this.output = [];
        this.labels.clear();
        this.functions.clear();
        this.loopCursors.clear();
    }
    snapshot() {
        return this.runtimeState.captureSnapshot(this.pc);
    }
    restore(snapshot) {
        this.runtimeState.restoreSnapshot(snapshot);
        this.pc = snapshot.pc;
    }
    // ── Program Execution ─────────────────────────────────────────────────────
    execute(programOrSource) {
        let ir;
        if (typeof programOrSource === 'string') {
            const compilation = this.compiler.compile(programOrSource);
            if (!compilation.success || !compilation.ir) {
                const firstDiag = compilation.diagnostics[0];
                const msg = firstDiag ? firstDiag.message : 'Compilation failed';
                return {
                    success: false,
                    state: 'ERRORED',
                    output: [],
                    globals: {},
                    instructionsExecuted: 0,
                    cycleCount: 0,
                    virtualTimestamp: 0,
                    rssAllocatedMb: 0,
                    isActuationBlocked: true,
                    snapshot: this.runtimeState.captureSnapshot(0),
                    error: {
                        code: firstDiag ? firstDiag.code : 'E7002',
                        message: msg,
                        pc: 0,
                        callStack: [],
                    },
                };
            }
            ir = compilation.ir;
        }
        else {
            ir = programOrSource;
        }
        this.reset();
        this.instructions = ir.instructions;
        this.buildIndexes();
        this.executionModel.transition('RUNNING');
        try {
            while (this.pc < this.instructions.length) {
                const instr = this.instructions[this.pc];
                this.pc++;
                this.executionModel.advanceCycle(1);
                this.dispatch(instr);
            }
            this.executionModel.transition('HALTED');
            const rawGlobals = {};
            for (const [k, v] of this.runtimeState.getGlobalsMap().entries()) {
                rawGlobals[k] = toRaw(v);
            }
            return {
                success: true,
                state: 'HALTED',
                output: [...this.output],
                globals: rawGlobals,
                instructionsExecuted: this.executionModel.getInstructionsExecuted(),
                cycleCount: this.executionModel.getCycleCount(),
                virtualTimestamp: this.executionModel.getVirtualTimestamp(),
                rssAllocatedMb: this.runtimeState.getRssAllocatedMb(),
                isActuationBlocked: this.runtimeState.isActuationLocked(),
                snapshot: this.runtimeState.captureSnapshot(this.pc),
            };
        }
        catch (err) {
            if (this.executionModel.getState() === 'RUNNING') {
                try {
                    this.executionModel.transition('ERRORED');
                }
                catch {
                    // Ignore if already transitioned
                }
            }
            const rawGlobals = {};
            for (const [k, v] of this.runtimeState.getGlobalsMap().entries()) {
                rawGlobals[k] = toRaw(v);
            }
            const isRuntimeErr = err instanceof OneNativeRuntimeError;
            const code = isRuntimeErr ? err.code : 'E7002';
            const msg = err.message || String(err);
            const errPc = isRuntimeErr ? err.pc : this.pc - 1;
            const stack = isRuntimeErr ? err.callStack : this.runtimeState.getStackTrace();
            return {
                success: false,
                state: 'ERRORED',
                output: [...this.output],
                globals: rawGlobals,
                instructionsExecuted: this.executionModel.getInstructionsExecuted(),
                cycleCount: this.executionModel.getCycleCount(),
                virtualTimestamp: this.executionModel.getVirtualTimestamp(),
                rssAllocatedMb: this.runtimeState.getRssAllocatedMb(),
                isActuationBlocked: this.runtimeState.isActuationLocked(),
                snapshot: this.runtimeState.captureSnapshot(errPc),
                error: {
                    code,
                    message: msg,
                    pc: errPc,
                    callStack: stack,
                },
            };
        }
    }
    // ── Deterministic Replay Validator ────────────────────────────────────────
    verifyDeterminism(programOrSource, cycles = 100) {
        const snapshotHashes = [];
        const outputs = [];
        const cycleCounts = [];
        for (let i = 0; i < cycles; i++) {
            const res = this.execute(programOrSource);
            snapshotHashes.push(res.snapshot.snapshotHash);
            outputs.push(res.output.join('::'));
            cycleCounts.push(res.cycleCount);
        }
        const variance = NativeExecutionModel.computeVariance(cycleCounts);
        const replaysMatch = NativeExecutionModel.verifyBitExactReplay(snapshotHashes);
        const outputMatch = NativeExecutionModel.verifyBitExactReplay(outputs);
        return {
            certified: variance === 0.0 && replaysMatch && outputMatch,
            cyclesEvaluated: cycles,
            sigmaSqVariance: variance,
            baselineHash: snapshotHashes[0] || 'NONE',
            replaysMatch,
            outputMatch,
            invariantActuationBlocked: this.runtimeState.isActuationLocked(),
        };
    }
    // ── Instruction Indexing ──────────────────────────────────────────────────
    buildIndexes() {
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];
            if (instr.opcode === 'CONST' && instr.metadata?.isFunctionHeader) {
                const name = instr.metadata.name;
                const params = instr.metadata.params || [];
                const endLabel = instr.metadata.endLabel;
                this.functions.set(name, {
                    name,
                    entryPC: i + 1,
                    paramNames: params,
                    endLabel,
                });
            }
            if (instr.opcode === 'CONST' &&
                instr.metadata?.isLabel &&
                instr.destination?.kind === 'label') {
                const labelName = instr.destination.value;
                this.labels.set(labelName, i + 1);
            }
        }
    }
    // ── Dispatch Loop ─────────────────────────────────────────────────────────
    dispatch(instr) {
        switch (instr.opcode) {
            case 'CONST': {
                if (instr.metadata?.isLabel && !instr.metadata?.isFunctionHeader)
                    break;
                if (instr.metadata?.isFunctionHeader) {
                    if (instr.metadata.endLabel) {
                        this.pc = this.resolveLabel(instr.metadata.endLabel);
                    }
                    else {
                        this.pc = this.findFunctionEnd(this.pc - 1);
                    }
                    break;
                }
                if (instr.destination && instr.metadata?.isArrayLiteral) {
                    const items = instr.sources.map((s) => this.loadOperand(s));
                    this.setDest(instr.destination, createArray(items));
                    break;
                }
                if (instr.destination && instr.metadata?.isObjectLiteral) {
                    const keys = instr.metadata.keys || [];
                    const entries = {};
                    for (let k = 0; k < keys.length; k++) {
                        entries[keys[k]] = this.loadOperand(instr.sources[k]);
                    }
                    this.setDest(instr.destination, createRecord(entries));
                    break;
                }
                if (instr.destination && instr.sources.length > 0) {
                    const val = this.loadOperand(instr.sources[0]);
                    this.setDest(instr.destination, val);
                }
                break;
            }
            case 'MAKE_CLOSURE': {
                if (!instr.destination)
                    break;
                const name = instr.metadata?.name || 'anon';
                const capturedVarNames = instr.metadata?.capturedVars || [];
                const fnDesc = this.functions.get(name);
                if (!fnDesc) {
                    throw new OneNativeRuntimeError('E7005', `Cannot create closure for unknown function '${name}'`, this.pc - 1);
                }
                const env = new Map();
                for (const varName of capturedVarNames) {
                    if (this.runtimeState.hasVariable(varName)) {
                        env.set(varName, this.runtimeState.getVariable(varName, this.pc - 1));
                    }
                }
                const closure = createClosure(fnDesc.name, fnDesc.paramNames, fnDesc.entryPC, env);
                this.setDest(instr.destination, closure);
                break;
            }
            case 'LOAD': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                // For-in iterator advance
                if (instr.metadata?.iteratorVar && instr.metadata?.endLabel) {
                    const iterVal = this.loadOperand(instr.sources[0]);
                    const endTargetPC = this.resolveLabel(instr.metadata.endLabel);
                    if (iterVal.kind === 'array') {
                        const list = iterVal.value;
                        const loopKey = instr.index;
                        const currentIdx = this.loopCursors.get(loopKey) ?? 0;
                        if (currentIdx >= list.length) {
                            this.loopCursors.delete(loopKey);
                            this.pc = endTargetPC;
                            break;
                        }
                        this.loopCursors.set(loopKey, currentIdx + 1);
                        this.setDest(instr.destination, list[currentIdx]);
                        break;
                    }
                }
                const src = instr.sources[0];
                const val = this.loadVar(src);
                this.setDest(instr.destination, val);
                break;
            }
            case 'STORE': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const val = this.loadOperand(instr.sources[0]);
                this.storeVar(instr.destination, val);
                break;
            }
            case 'MOVE': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const val = this.loadOperand(instr.sources[0]);
                this.setDest(instr.destination, val);
                break;
            }
            case 'ADD': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.loadOperand(instr.sources[0]);
                const right = this.loadOperand(instr.sources[1]);
                if (left.kind === 'string' || right.kind === 'string') {
                    const s = String(toRaw(left)) + String(toRaw(right));
                    this.setDest(instr.destination, createString(s));
                }
                else {
                    const nl = Number(toRaw(left)) || 0;
                    const nr = Number(toRaw(right)) || 0;
                    const dt = instr.destination.type?.toLowerCase();
                    if (dt === 'i32' || dt === 'int32') {
                        this.setDest(instr.destination, createI32(DeterministicNumericOps.addI32(nl, nr)));
                    }
                    else if (dt === 'f32' || dt === 'float32') {
                        this.setDest(instr.destination, createF32(DeterministicNumericOps.addF32(nl, nr)));
                    }
                    else {
                        const isF = left.kind === 'float' || right.kind === 'float' || left.kind === 'f32' || right.kind === 'f32';
                        this.setDest(instr.destination, isF ? createFloat(nl + nr) : createInt(nl + nr));
                    }
                }
                break;
            }
            case 'SUB': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0]);
                const right = this.numOperand(instr.sources[1]);
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32') {
                    this.setDest(instr.destination, createI32(DeterministicNumericOps.subI32(left, right)));
                }
                else if (dt === 'f32' || dt === 'float32') {
                    this.setDest(instr.destination, createF32(DeterministicNumericOps.subF32(left, right)));
                }
                else {
                    this.setDest(instr.destination, createFloat(left - right));
                }
                break;
            }
            case 'MUL': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0]);
                const right = this.numOperand(instr.sources[1]);
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32') {
                    this.setDest(instr.destination, createI32(DeterministicNumericOps.mulI32(left, right)));
                }
                else if (dt === 'f32' || dt === 'float32') {
                    this.setDest(instr.destination, createF32(DeterministicNumericOps.mulF32(left, right)));
                }
                else {
                    this.setDest(instr.destination, createFloat(left * right));
                }
                break;
            }
            case 'DIV': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0]);
                const right = this.numOperand(instr.sources[1]);
                if (right === 0) {
                    throw new OneNativeRuntimeError('E7001', 'Division by zero', this.pc - 1);
                }
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32') {
                    this.setDest(instr.destination, createI32(DeterministicNumericOps.divI32(left, right)));
                }
                else if (dt === 'f32' || dt === 'float32') {
                    this.setDest(instr.destination, createF32(DeterministicNumericOps.divF32(left, right)));
                }
                else {
                    this.setDest(instr.destination, createFloat(left / right));
                }
                break;
            }
            case 'MOD': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0]);
                const right = this.numOperand(instr.sources[1]);
                if (right === 0) {
                    throw new OneNativeRuntimeError('E7001', 'Modulo by zero', this.pc - 1);
                }
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32') {
                    this.setDest(instr.destination, createI32(DeterministicNumericOps.modI32(left, right)));
                }
                else if (dt === 'f32' || dt === 'float32') {
                    this.setDest(instr.destination, createF32(DeterministicNumericOps.modF32(left, right)));
                }
                else {
                    this.setDest(instr.destination, createFloat(left % right));
                }
                break;
            }
            case 'CMP': {
                if (!instr.destination)
                    break;
                const operator = instr.metadata?.operator;
                if (operator === '!' && instr.sources.length >= 1) {
                    const val = this.loadOperand(instr.sources[0]);
                    this.setDest(instr.destination, createBool(!toRaw(val)));
                    break;
                }
                if (instr.sources.length < 2 || !operator)
                    break;
                const left = this.loadOperand(instr.sources[0]);
                const right = this.loadOperand(instr.sources[1]);
                let res = false;
                switch (operator) {
                    case '<':
                        res = compare(left, right) < 0;
                        break;
                    case '<=':
                        res = compare(left, right) <= 0;
                        break;
                    case '>':
                        res = compare(left, right) > 0;
                        break;
                    case '>=':
                        res = compare(left, right) >= 0;
                        break;
                    case '==':
                        res = isEqual(left, right);
                        break;
                    case '!=':
                        res = !isEqual(left, right);
                        break;
                    case '&&':
                        res = Boolean(toRaw(left)) && Boolean(toRaw(right));
                        break;
                    case '||':
                        res = Boolean(toRaw(left)) || Boolean(toRaw(right));
                        break;
                }
                this.setDest(instr.destination, createBool(res));
                break;
            }
            case 'EQ':
            case 'NE':
            case 'LT':
            case 'LTE':
            case 'GT':
            case 'GTE': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.loadOperand(instr.sources[0]);
                const right = this.loadOperand(instr.sources[1]);
                let res = false;
                if (instr.opcode === 'EQ')
                    res = isEqual(left, right);
                else if (instr.opcode === 'NE')
                    res = !isEqual(left, right);
                else if (instr.opcode === 'LT')
                    res = compare(left, right) < 0;
                else if (instr.opcode === 'LTE')
                    res = compare(left, right) <= 0;
                else if (instr.opcode === 'GT')
                    res = compare(left, right) > 0;
                else if (instr.opcode === 'GTE')
                    res = compare(left, right) >= 0;
                this.setDest(instr.destination, createBool(res));
                break;
            }
            case 'JUMP': {
                const labelOp = instr.destination;
                if (labelOp?.kind === 'label') {
                    this.pc = this.resolveLabel(labelOp.value);
                }
                break;
            }
            case 'JUMP_IF': {
                const labelOp = instr.destination;
                if (!labelOp || labelOp.kind !== 'label')
                    break;
                const targetPC = this.resolveLabel(labelOp.value);
                if (instr.sources.length === 0)
                    break;
                const condVal = this.loadOperand(instr.sources[0]);
                const cond = Boolean(toRaw(condVal));
                const conditionMode = instr.metadata?.condition;
                if (conditionMode === 'false') {
                    if (!cond)
                        this.pc = targetPC;
                }
                else {
                    if (cond)
                        this.pc = targetPC;
                }
                break;
            }
            case 'JUMP_IF_FALSE': {
                const labelOp = instr.destination;
                if (!labelOp || labelOp.kind !== 'label')
                    break;
                const targetPC = this.resolveLabel(labelOp.value);
                if (instr.sources.length === 0)
                    break;
                const condVal = this.loadOperand(instr.sources[0]);
                if (!toRaw(condVal)) {
                    this.pc = targetPC;
                }
                break;
            }
            case 'PRINT': {
                if (instr.sources.length === 0)
                    break;
                const val = this.loadOperand(instr.sources[0]);
                const raw = toRaw(val);
                const str = raw === null
                    ? 'null'
                    : typeof raw === 'object'
                        ? JSON.stringify(raw)
                        : String(raw);
                this.output.push(str);
                break;
            }
            case 'CALL': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const calleeOp = instr.sources[0];
                const calleeName = String(calleeOp.value);
                // Gather argument values
                const args = [];
                for (let i = 1; i < instr.sources.length; i++) {
                    args.push(this.loadOperand(instr.sources[i]));
                }
                // Method call pattern: Object.method (e.g. Math.sqrt, spatial.get)
                if (calleeName.includes('.')) {
                    const [objName, methodName] = calleeName.split('.');
                    if (this.runtimeState.hasVariable(objName)) {
                        const objVal = this.runtimeState.getVariable(objName);
                        if (objVal.kind === 'record') {
                            const rec = objVal.value;
                            const methodVal = rec[methodName];
                            if (methodVal && methodVal.kind === 'native_fn') {
                                const fn = methodVal.value.fn;
                                // Note: First source was objReg, skip it for namespace methods
                                const methodArgs = instr.metadata?.isMethodCall ? args.slice(1) : args;
                                const result = fn(...methodArgs);
                                this.setDest(instr.destination, result || createNull());
                                break;
                            }
                        }
                    }
                }
                // Check if callee is a closure in a variable or register
                let calleeVal = undefined;
                if (calleeOp.kind === 'register') {
                    calleeVal = this.loadOperand(calleeOp);
                }
                else if (this.runtimeState.hasVariable(calleeName)) {
                    calleeVal = this.runtimeState.getVariable(calleeName, this.pc - 1);
                }
                if (calleeVal && calleeVal.kind === 'closure') {
                    const cl = calleeVal.value;
                    this.executionModel.checkCallDepth(this.runtimeState.getCallDepth() + 1);
                    const frame = this.runtimeState.pushCallFrame(cl.name, this.pc, instr.destination.kind === 'register' ? String(instr.destination.value) : null);
                    if (cl.env) {
                        for (const [k, v] of cl.env.entries()) {
                            frame.locals.set(k, v);
                        }
                    }
                    for (let i = 0; i < cl.params.length; i++) {
                        frame.locals.set(cl.params[i], args[i] || createNull());
                    }
                    this.pc = cl.entryPC;
                    break;
                }
                // Standard user-defined function
                const fnDesc = this.functions.get(calleeName);
                if (fnDesc) {
                    this.executionModel.checkCallDepth(this.runtimeState.getCallDepth() + 1);
                    const frame = this.runtimeState.pushCallFrame(calleeName, this.pc, instr.destination.kind === 'register' ? String(instr.destination.value) : null);
                    for (let i = 0; i < fnDesc.paramNames.length; i++) {
                        frame.locals.set(fnDesc.paramNames[i], args[i] || createNull());
                    }
                    this.pc = fnDesc.entryPC;
                    break;
                }
                throw new OneNativeRuntimeError('E7005', `Undefined function '${calleeName}'`, this.pc - 1, this.runtimeState.getStackTrace());
            }
            case 'RETURN': {
                let returnVal = createNull();
                if (instr.sources.length > 0) {
                    returnVal = this.loadOperand(instr.sources[0]);
                }
                if (this.runtimeState.getCallDepth() === 0) {
                    this.pc = this.instructions.length;
                    break;
                }
                const frame = this.runtimeState.popCallFrame();
                this.pc = frame.returnPC;
                if (frame.returnDestRegister !== null) {
                    this.runtimeState.setRegister(frame.returnDestRegister, returnVal);
                }
                break;
            }
            // ── Member Access: FIELD_GET / FIELD_SET / INDEX_GET / INDEX_SET ───────
            case 'FIELD_GET': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const objVal = this.loadOperand(instr.sources[0]);
                const fieldName = instr.metadata?.field || '';
                if (objVal.kind === 'record') {
                    const rec = objVal.value;
                    if (!(fieldName in rec)) {
                        throw new OneNativeRuntimeError('E7009', `Field '${fieldName}' not found on record`, this.pc - 1);
                    }
                    this.setDest(instr.destination, rec[fieldName]);
                    break;
                }
                if (objVal.kind === 'string' && fieldName === 'length') {
                    this.setDest(instr.destination, createInt(objVal.value.length));
                    break;
                }
                if (objVal.kind === 'array' && fieldName === 'length') {
                    this.setDest(instr.destination, createInt(objVal.value.length));
                    break;
                }
                throw new OneNativeRuntimeError('E7003', `Cannot read property '${fieldName}' of non-record type ${objVal.kind}`, this.pc - 1);
            }
            case 'FIELD_SET': {
                if (instr.sources.length < 2)
                    break;
                const objVal = this.loadOperand(instr.sources[0]);
                const valToSet = this.loadOperand(instr.sources[1]);
                const fieldName = instr.metadata?.field || '';
                if (objVal.kind !== 'record') {
                    throw new OneNativeRuntimeError('E7003', `Cannot set property '${fieldName}' on non-record type ${objVal.kind}`, this.pc - 1);
                }
                const rec = objVal.value;
                rec[fieldName] = valToSet;
                break;
            }
            case 'INDEX_GET': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const arrVal = this.loadOperand(instr.sources[0]);
                const idxVal = this.loadOperand(instr.sources[1]);
                const idx = Number(toRaw(idxVal));
                if (arrVal.kind === 'array') {
                    const list = arrVal.value;
                    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
                        throw new OneNativeRuntimeError('E7008', `Array index ${idx} out of bounds [0..${list.length - 1}]`, this.pc - 1);
                    }
                    this.setDest(instr.destination, list[idx]);
                    break;
                }
                if (arrVal.kind === 'string') {
                    const str = arrVal.value;
                    if (!Number.isInteger(idx) || idx < 0 || idx >= str.length) {
                        throw new OneNativeRuntimeError('E7008', `String index ${idx} out of bounds [0..${str.length - 1}]`, this.pc - 1);
                    }
                    this.setDest(instr.destination, createString(str.charAt(idx)));
                    break;
                }
                throw new OneNativeRuntimeError('E7003', `Cannot index into non-indexable type ${arrVal.kind}`, this.pc - 1);
            }
            case 'INDEX_SET': {
                if (instr.sources.length < 3)
                    break;
                const arrVal = this.loadOperand(instr.sources[0]);
                const idxVal = this.loadOperand(instr.sources[1]);
                const valToSet = this.loadOperand(instr.sources[2]);
                const idx = Number(toRaw(idxVal));
                if (arrVal.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', `Cannot index-assign into non-array type ${arrVal.kind}`, this.pc - 1);
                }
                const list = arrVal.value;
                if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
                    throw new OneNativeRuntimeError('E7008', `Array index ${idx} out of bounds [0..${list.length - 1}]`, this.pc - 1);
                }
                list[idx] = valToSet;
                break;
            }
            case 'SPATIAL_OP': {
                // Preserved declarative spatial instruction (handled by CubiO VM)
                break;
            }
            case 'AWAIT': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const operandVal = this.loadOperand(instr.sources[0]);
                this.setDest(instr.destination, operandVal);
                break;
            }
            default: {
                throw new OneNativeRuntimeError('E7002', `Unknown opcode '${instr.opcode}'`, this.pc - 1);
            }
        }
    }
    // ── Operand Helpers ───────────────────────────────────────────────────────
    loadOperand(op) {
        switch (op.kind) {
            case 'constant':
                return fromRaw(op.value);
            case 'register': {
                const name = String(op.value);
                return this.runtimeState.getRegister(name, this.pc - 1);
            }
            case 'variable': {
                const name = String(op.value);
                return this.loadVar(op);
            }
            case 'label':
                return createString(String(op.value));
            default:
                return createNull();
        }
    }
    loadVar(op) {
        const name = String(op.value);
        return this.runtimeState.getVariable(name, this.pc - 1);
    }
    storeVar(dest, value) {
        const name = String(dest.value);
        let coercedVal = value;
        if (dest.type) {
            const dt = dest.type.toLowerCase();
            if (dt === 'i32' || dt === 'int32') {
                coercedVal = createI32(Number(toRaw(value)) || 0);
            }
            else if (dt === 'f32' || dt === 'float32') {
                coercedVal = createF32(Number(toRaw(value)) || 0.0);
            }
            else if (dt === 'bool' || dt === 'boolean') {
                coercedVal = createBool(Boolean(toRaw(value)));
            }
        }
        this.runtimeState.setVariable(name, coercedVal);
    }
    setDest(dest, value) {
        const name = String(dest.value);
        if (dest.kind === 'register') {
            this.runtimeState.setRegister(name, value);
        }
        else if (dest.kind === 'variable') {
            this.storeVar(dest, value);
        }
    }
    numOperand(op) {
        const val = this.loadOperand(op);
        if (val.kind !== 'int' && val.kind !== 'float' && val.kind !== 'i32' && val.kind !== 'f32') {
            throw new OneNativeRuntimeError('E7003', `Expected numeric operand but got ${val.kind}`, this.pc - 1);
        }
        return val.value;
    }
    resolveLabel(labelName) {
        const target = this.labels.get(labelName);
        if (target === undefined) {
            throw new OneNativeRuntimeError('E7002', `Undefined label target '${labelName}'`, this.pc - 1);
        }
        return target;
    }
    findFunctionEnd(headerPC) {
        let depth = 0;
        for (let i = headerPC; i < this.instructions.length; i++) {
            const op = this.instructions[i].opcode;
            if (op === 'CONST' && this.instructions[i].metadata?.isFunctionHeader) {
                depth++;
            }
            if (op === 'RETURN') {
                depth--;
                if (depth === 0) {
                    return i + 1;
                }
            }
        }
        return this.instructions.length;
    }
}
