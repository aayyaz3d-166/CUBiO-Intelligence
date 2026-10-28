/**
 * ONE Language — Phase 3: Unified VM / Runtime
 * ============================================
 * Executes the UnifiedIRProgram produced by Phase 2 IR Lowering.
 *
 * Architecture:
 *   - Stack machine with explicit Call Frames
 *   - Program Counter (PC) stepping through IRInstruction stream
 *   - Operand stack per call frame
 *   - Variable store (locals) per call frame
 *   - Global variable store (top-level scope)
 *   - Function registry (name → entry PC, param descriptors)
 *   - Zero dynamic code evaluation, zero Function constructor, zero host-code escape
 *
 * Safety Guards:
 *   - Division-by-zero / Modulo-by-zero: throws OneVMError (E5001)
 *   - Unknown opcode:                     throws OneVMError (E5002)
 *   - Stack underflow / Type error:       throws OneVMError (E5003)
 *   - Undefined variable:                 throws OneVMError (E5004)
 *   - Undefined function:                 throws OneVMError (E5005)
 *   - Max call depth exceeded (512):      throws OneVMError (E5006)
 *   - Max instructions exceeded (10^6):   throws OneVMError (E5007)
 */
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';
import { DeterministicNumericOps, toI32, toF32, toBool } from '../types/TypedNumeric';
import { TENSOR_BUILTIN_FUNCTIONS } from '../jit/JITRuntimeContext';
import { SpatialBridge } from '../spatial/SpatialBridge';
export function isVMClosure(val) {
    return typeof val === 'object' && val !== null && val.__isClosure === true;
}
export function isVMPromise(val) {
    return typeof val === 'object' && val !== null && val.__isPromise === true;
}
export class OneVMError extends Error {
    code;
    pc;
    callStack;
    constructor(code, message, pc, callStack) {
        super(`[${code}] at PC ${pc}: ${message}`);
        this.name = 'OneVMError';
        this.code = code;
        this.pc = pc;
        this.callStack = callStack;
    }
}
const MAX_CALL_DEPTH = 512;
const MAX_INSTRUCTIONS = 1_000_000;
export class UnifiedVM {
    // Configurable resource limits
    maxCallDepth = MAX_CALL_DEPTH;
    maxInstructions = MAX_INSTRUCTIONS;
    options;
    mockInputQueue = [];
    // Global variable store (top-level environment)
    globals = new Map();
    // Global register store (top-level registers)
    globalRegisters = new Map();
    // Function registry: function name → descriptor
    functions = new Map();
    // Built-in standard library function registry
    builtins = new Map();
    // Label index: label name → instruction PC
    labels = new Map();
    // Call stack holding active activation records
    callStack = [];
    // Loop iteration cursors for for-in loops: instruction index → current array index
    loopCursors = new Map();
    // Standard output captured from PRINT opcodes
    output = [];
    // Flat instruction array being interpreted
    instructions = [];
    // Program counter
    pc = 0;
    // Counter of executed instructions for timeout / infinite loop protection
    instructionsExecuted = 0;
    // Asynchronous Task Scheduler & Promise Registry
    nextTaskId = 1;
    nextPromiseId = 1;
    tasks = new Map();
    taskQueue = [];
    currentTaskId = 0;
    /**
     * Execute a UnifiedIRProgram from start to finish.
     */
    execute(program, options) {
        const startMs = performance.now();
        // Configure resource limits for this run
        this.maxCallDepth = options?.maxCallDepth ?? MAX_CALL_DEPTH;
        this.maxInstructions = options?.maxInstructions ?? MAX_INSTRUCTIONS;
        this.options = options;
        this.mockInputQueue = options?.mockInputs ? [...options.mockInputs] : [];
        // Reset runtime state
        this.globals = new Map();
        this.globalRegisters = new Map();
        this.functions = new Map();
        this.builtins = new Map();
        for (const [bName, bFn] of Object.entries(ONE_BUILTIN_FUNCTIONS)) {
            this.builtins.set(bName, bFn);
        }
        for (const [bName, bFn] of Object.entries(TENSOR_BUILTIN_FUNCTIONS)) {
            this.builtins.set(bName, bFn);
        }
        // Attach spatial bridge methods to global and builtins
        const bridge = options?.spatialBridge ?? new SpatialBridge();
        const spatialObj = bridge.toVMObject();
        this.globals.set('spatial', spatialObj);
        for (const [mName, mFn] of Object.entries(spatialObj)) {
            this.builtins.set(`spatial.${mName}`, mFn);
        }
        this.labels = new Map();
        this.callStack = [];
        this.loopCursors = new Map();
        this.output = [];
        this.instructions = program.instructions;
        this.pc = 0;
        this.instructionsExecuted = 0;
        // Initialize root main task
        this.nextTaskId = 1;
        this.nextPromiseId = 1;
        this.tasks = new Map();
        this.taskQueue = [];
        this.currentTaskId = 0;
        const mainTask = {
            id: 0,
            name: 'main',
            pc: 0,
            callStack: this.callStack,
            state: 'runnable',
        };
        this.tasks.set(0, mainTask);
        this.taskQueue.push(0);
        try {
            // Pass 1: Build label index and function registry
            this.buildIndexes();
            // Pass 2: Interpret instruction stream
            this.runLoop();
            const executionTimeMs = performance.now() - startMs;
            return {
                success: true,
                output: [...this.output],
                globals: Object.fromEntries(this.globals),
                instructionsExecuted: this.instructionsExecuted,
                executionTimeMs,
            };
        }
        catch (err) {
            const executionTimeMs = performance.now() - startMs;
            if (err instanceof OneVMError) {
                return {
                    success: false,
                    output: [...this.output],
                    globals: Object.fromEntries(this.globals),
                    error: {
                        code: err.code,
                        message: err.message,
                        pc: err.pc,
                        callStack: err.callStack ?? this.getStackTrace(),
                    },
                    instructionsExecuted: this.instructionsExecuted,
                    executionTimeMs,
                };
            }
            const msg = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                output: [...this.output],
                globals: Object.fromEntries(this.globals),
                error: {
                    code: 'E5000',
                    message: msg,
                    pc: this.pc,
                    callStack: this.getStackTrace(),
                },
                instructionsExecuted: this.instructionsExecuted,
                executionTimeMs,
            };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Pass 1: Index Labels and Functions
    // ─────────────────────────────────────────────────────────────────────────
    buildIndexes() {
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];
            // CONST with isFunctionHeader
            if (instr.opcode === 'CONST' && instr.metadata?.isFunctionHeader) {
                const name = instr.metadata.name;
                const params = instr.metadata.params || instr.metadata.paramNames || [];
                const endLabel = instr.metadata.endLabel;
                const isAsync = Boolean(instr.metadata.isAsync);
                this.functions.set(name, {
                    name,
                    entryPC: i + 1,
                    paramNames: params,
                    endLabel,
                    isAsync,
                });
            }
            // CONST with isLabel
            if (instr.opcode === 'CONST' &&
                instr.metadata?.isLabel &&
                instr.destination?.kind === 'label') {
                const labelName = instr.destination.value;
                // Target is the instruction immediately following the label marker
                this.labels.set(labelName, i + 1);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Pass 2: Interpretation Loop
    // ─────────────────────────────────────────────────────────────────────────
    runLoop() {
        while (this.hasRunnableTasks()) {
            const task = this.tasks.get(this.currentTaskId);
            if (task.state !== 'runnable') {
                this.scheduleNextTask();
                continue;
            }
            this.pc = task.pc;
            this.callStack = task.callStack;
            while (this.pc < this.instructions.length && task.state === 'runnable') {
                if (this.instructionsExecuted >= this.maxInstructions) {
                    throw new OneVMError('E5007', `Max instruction count exceeded (infinite loop guard: ${this.maxInstructions.toLocaleString()} ops)`, this.pc, this.getStackTrace());
                }
                const instr = this.instructions[this.pc];
                this.pc++;
                this.instructionsExecuted++;
                try {
                    this.dispatch(instr);
                }
                catch (err) {
                    if (task.promise) {
                        task.promise.state = 'rejected';
                        task.promise.error = err instanceof OneVMError
                            ? err
                            : new OneVMError('E5000', String(err), this.pc - 1, this.getStackTrace());
                        task.state = 'completed';
                        this.notifyPromiseSettled(task.promise);
                        break;
                    }
                    else {
                        throw err;
                    }
                }
                task.pc = this.pc;
            }
            if (this.pc >= this.instructions.length && task.state === 'runnable') {
                task.state = 'completed';
                if (task.promise && task.promise.state === 'pending') {
                    task.promise.state = 'resolved';
                    task.promise.value = null;
                    this.notifyPromiseSettled(task.promise);
                }
            }
            this.scheduleNextTask();
        }
        const suspended = Array.from(this.tasks.values()).filter((t) => t.state === 'suspended');
        if (suspended.length > 0) {
            throw new OneVMError('E5011', `Asynchronous deadlock: ${suspended.length} task(s) suspended waiting for unresolved promises`, this.pc, this.getStackTrace());
        }
    }
    hasRunnableTasks() {
        for (const t of this.tasks.values()) {
            if (t.state === 'runnable')
                return true;
        }
        return false;
    }
    scheduleNextTask() {
        const curr = this.tasks.get(this.currentTaskId);
        if (curr) {
            curr.pc = this.pc;
            curr.callStack = this.callStack;
        }
        const nextId = this.taskQueue.find((id) => this.tasks.get(id)?.state === 'runnable');
        if (nextId !== undefined) {
            const idx = this.taskQueue.indexOf(nextId);
            this.taskQueue.splice(idx, 1);
            this.taskQueue.push(nextId);
            this.currentTaskId = nextId;
            const nextTask = this.tasks.get(nextId);
            this.pc = nextTask.pc;
            this.callStack = nextTask.callStack;
        }
    }
    notifyPromiseSettled(promise) {
        const listeners = [...promise.onSettled];
        promise.onSettled = [];
        for (const listener of listeners) {
            listener(promise);
        }
    }
    dispatch(instr) {
        switch (instr.opcode) {
            // ── CONST ─────────────────────────────────────────────────────────────
            case 'CONST': {
                // Label marker — no-op during execution (already indexed)
                if (instr.metadata?.isLabel && !instr.metadata?.isFunctionHeader)
                    break;
                // Function header — skip body during top-level linear execution
                if (instr.metadata?.isFunctionHeader) {
                    if (instr.metadata.endLabel) {
                        this.pc = this.resolveLabel(instr.metadata.endLabel, instr);
                    }
                    else {
                        this.pc = this.findFunctionEnd(this.pc - 1);
                    }
                    break;
                }
                // Array literal
                if (instr.destination && instr.metadata?.isArrayLiteral) {
                    const arr = instr.sources.map((s) => this.loadOperand(s));
                    this.setDest(instr.destination, arr);
                    break;
                }
                // Object literal / Struct / Enum
                if (instr.destination && instr.metadata?.isObjectLiteral) {
                    const obj = {};
                    const keys = instr.metadata.keys || [];
                    for (let k = 0; k < keys.length; k++) {
                        obj[keys[k]] = this.loadOperand(instr.sources[k]);
                    }
                    if (instr.metadata.isStruct && instr.metadata.structName) {
                        Object.defineProperty(obj, '__structName', {
                            value: instr.metadata.structName,
                            enumerable: false,
                            writable: false,
                            configurable: false,
                        });
                        Object.defineProperty(obj, '__declaredFields', {
                            value: new Set(keys),
                            enumerable: false,
                            writable: false,
                            configurable: false,
                        });
                    }
                    if (instr.metadata.isEnum) {
                        Object.defineProperty(obj, '__isEnum', {
                            value: true,
                            enumerable: false,
                            writable: false,
                            configurable: false,
                        });
                    }
                    this.setDest(instr.destination, obj);
                    break;
                }
                // Scalar constant load: CONST dest, [constOperand]
                if (instr.destination && instr.sources.length > 0) {
                    const value = this.resolveConstantOperand(instr.sources[0]);
                    this.setDest(instr.destination, value);
                }
                break;
            }
            // ── MAKE_CLOSURE ──────────────────────────────────────────────────────
            case 'MAKE_CLOSURE': {
                if (!instr.destination)
                    break;
                const name = instr.metadata?.name || 'anon';
                const capturedVarNames = instr.metadata?.capturedVars || [];
                const fnDesc = this.functions.get(name);
                if (!fnDesc) {
                    throw new OneVMError('E5005', `Cannot create closure for unknown function '${name}'`, this.pc - 1);
                }
                const currentFrame = this.callStack.length > 0
                    ? this.callStack[this.callStack.length - 1]
                    : null;
                const env = new Map();
                for (const varName of capturedVarNames) {
                    let cell = undefined;
                    if (currentFrame) {
                        // 1. Check if current frame already has a cell for this variable
                        if (currentFrame.cells.has(varName)) {
                            cell = currentFrame.cells.get(varName);
                        }
                        // 2. Check if current frame captured it from an enclosing closure
                        else if (currentFrame.capturedEnv && currentFrame.capturedEnv.has(varName)) {
                            cell = currentFrame.capturedEnv.get(varName);
                        }
                        // 3. Otherwise, it is a local in current frame; create a new cell
                        else {
                            const initialVal = currentFrame.locals.has(varName)
                                ? currentFrame.locals.get(varName)
                                : null;
                            cell = { value: initialVal };
                            currentFrame.cells.set(varName, cell);
                        }
                    }
                    else {
                        // Top-level closure: check globals
                        const initialVal = this.globals.has(varName)
                            ? this.globals.get(varName)
                            : null;
                        cell = { value: initialVal };
                    }
                    env.set(varName, cell);
                }
                const closure = {
                    __isClosure: true,
                    name: fnDesc.name,
                    entryPC: fnDesc.entryPC,
                    paramNames: fnDesc.paramNames,
                    capturedEnv: env,
                    isAsync: Boolean(fnDesc.isAsync || instr.metadata?.isAsync),
                };
                this.setDest(instr.destination, closure);
                break;
            }
            // ── LOAD ──────────────────────────────────────────────────────────────
            case 'LOAD': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                // For-in loop iterator advance
                if (instr.metadata?.iteratorVar && instr.metadata?.endLabel) {
                    const iterVal = this.loadOperand(instr.sources[0]);
                    const endTargetPC = this.resolveLabel(instr.metadata.endLabel, instr);
                    if (Array.isArray(iterVal)) {
                        const loopKey = instr.index;
                        const currentIdx = this.loopCursors.get(loopKey) ?? 0;
                        if (currentIdx >= iterVal.length) {
                            this.loopCursors.delete(loopKey);
                            this.pc = endTargetPC;
                            break;
                        }
                        this.loopCursors.set(loopKey, currentIdx + 1);
                        this.setDest(instr.destination, iterVal[currentIdx]);
                        break;
                    }
                }
                const src = instr.sources[0];
                const value = this.loadVar(src);
                this.setDest(instr.destination, value);
                break;
            }
            // ── STORE ─────────────────────────────────────────────────────────────
            case 'STORE': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const value = this.loadOperand(instr.sources[0]);
                this.storeVar(instr.destination, value);
                break;
            }
            // ── MOVE ──────────────────────────────────────────────────────────────
            case 'MOVE': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const value = this.loadOperand(instr.sources[0]);
                this.setDest(instr.destination, value);
                break;
            }
            // ── ADD ───────────────────────────────────────────────────────────────
            case 'ADD': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.loadOperand(instr.sources[0]);
                const right = this.loadOperand(instr.sources[1]);
                if (typeof left === 'string' || typeof right === 'string') {
                    this.setDest(instr.destination, String(left) + String(right));
                }
                else {
                    const dt = instr.destination.type?.toLowerCase();
                    if (dt === 'i32' || dt === 'int32' || dt === 'int') {
                        this.setDest(instr.destination, DeterministicNumericOps.addI32(Number(left) || 0, Number(right) || 0));
                    }
                    else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
                        this.setDest(instr.destination, DeterministicNumericOps.addF32(Number(left) || 0, Number(right) || 0));
                    }
                    else {
                        this.setDest(instr.destination, left + right);
                    }
                }
                break;
            }
            // ── SUB ───────────────────────────────────────────────────────────────
            case 'SUB': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0], instr);
                const right = this.numOperand(instr.sources[1], instr);
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32' || dt === 'int') {
                    this.setDest(instr.destination, DeterministicNumericOps.subI32(left, right));
                }
                else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
                    this.setDest(instr.destination, DeterministicNumericOps.subF32(left, right));
                }
                else {
                    this.setDest(instr.destination, left - right);
                }
                break;
            }
            // ── MUL ───────────────────────────────────────────────────────────────
            case 'MUL': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0], instr);
                const right = this.numOperand(instr.sources[1], instr);
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32' || dt === 'int') {
                    this.setDest(instr.destination, DeterministicNumericOps.mulI32(left, right));
                }
                else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
                    this.setDest(instr.destination, DeterministicNumericOps.mulF32(left, right));
                }
                else {
                    this.setDest(instr.destination, left * right);
                }
                break;
            }
            // ── DIV ───────────────────────────────────────────────────────────────
            case 'DIV': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0], instr);
                const right = this.numOperand(instr.sources[1], instr);
                if (right === 0) {
                    throw new OneVMError('E5001', 'Division by zero', this.pc - 1);
                }
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32' || dt === 'int') {
                    this.setDest(instr.destination, DeterministicNumericOps.divI32(left, right));
                }
                else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
                    this.setDest(instr.destination, DeterministicNumericOps.divF32(left, right));
                }
                else {
                    this.setDest(instr.destination, left / right);
                }
                break;
            }
            // ── MOD ───────────────────────────────────────────────────────────────
            case 'MOD': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const left = this.numOperand(instr.sources[0], instr);
                const right = this.numOperand(instr.sources[1], instr);
                if (right === 0) {
                    throw new OneVMError('E5001', 'Modulo by zero', this.pc - 1);
                }
                const dt = instr.destination.type?.toLowerCase();
                if (dt === 'i32' || dt === 'int32' || dt === 'int') {
                    this.setDest(instr.destination, DeterministicNumericOps.modI32(left, right));
                }
                else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
                    this.setDest(instr.destination, DeterministicNumericOps.modF32(left, right));
                }
                else {
                    this.setDest(instr.destination, left % right);
                }
                break;
            }
            // ── CMP ───────────────────────────────────────────────────────────────
            case 'CMP': {
                if (!instr.destination)
                    break;
                const operator = instr.metadata?.operator;
                // Unary NOT: CMP dest, [operand] ; operator: '!'
                if (operator === '!' && instr.sources.length >= 1) {
                    const val = this.loadOperand(instr.sources[0]);
                    this.setDest(instr.destination, !val);
                    break;
                }
                if (instr.sources.length < 2 || !operator)
                    break;
                const left = this.loadOperand(instr.sources[0]);
                const right = this.loadOperand(instr.sources[1]);
                let result;
                switch (operator) {
                    case '<':
                        result = left < right;
                        break;
                    case '<=':
                        result = left <= right;
                        break;
                    case '>':
                        result = left > right;
                        break;
                    case '>=':
                        result = left >= right;
                        break;
                    case '==':
                        result = this.areValuesEqual(left, right);
                        break;
                    case '!=':
                        result = !this.areValuesEqual(left, right);
                        break;
                    case '&&':
                        result = Boolean(left) && Boolean(right);
                        break;
                    case '||':
                        result = Boolean(left) || Boolean(right);
                        break;
                    default: result = false;
                }
                this.setDest(instr.destination, result);
                break;
            }
            // ── Explicit Comparison Opcodes: EQ, NE, LT, LTE, GT, GTE ─────────────
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
                    res = left === right;
                else if (instr.opcode === 'NE')
                    res = left !== right;
                else if (instr.opcode === 'LT')
                    res = left < right;
                else if (instr.opcode === 'LTE')
                    res = left <= right;
                else if (instr.opcode === 'GT')
                    res = left > right;
                else if (instr.opcode === 'GTE')
                    res = left >= right;
                this.setDest(instr.destination, res);
                break;
            }
            // ── JUMP ──────────────────────────────────────────────────────────────
            case 'JUMP': {
                const labelOp = instr.destination;
                if (labelOp?.kind === 'label') {
                    this.pc = this.resolveLabel(labelOp.value, instr);
                }
                break;
            }
            // ── JUMP_IF ───────────────────────────────────────────────────────────
            case 'JUMP_IF': {
                const conditionMode = instr.metadata?.condition;
                const labelOp = instr.destination;
                if (!labelOp || labelOp.kind !== 'label')
                    break;
                const targetPC = this.resolveLabel(labelOp.value, instr);
                if (instr.sources.length === 0)
                    break;
                const condValue = this.loadOperand(instr.sources[0]);
                const condBool = Boolean(condValue);
                if (conditionMode === 'false') {
                    if (!condBool) {
                        this.pc = targetPC;
                    }
                }
                else {
                    if (condBool) {
                        this.pc = targetPC;
                    }
                }
                break;
            }
            // ── JUMP_IF_FALSE ─────────────────────────────────────────────────────
            case 'JUMP_IF_FALSE': {
                const labelOp = instr.destination;
                if (!labelOp || labelOp.kind !== 'label')
                    break;
                const targetPC = this.resolveLabel(labelOp.value, instr);
                if (instr.sources.length === 0)
                    break;
                const condValue = this.loadOperand(instr.sources[0]);
                if (!Boolean(condValue)) {
                    this.pc = targetPC;
                }
                break;
            }
            // ── PRINT ─────────────────────────────────────────────────────────────
            case 'PRINT': {
                if (instr.sources.length === 0)
                    break;
                const value = this.loadOperand(instr.sources[0]);
                const str = this.formatValue(value);
                this.output.push(str);
                break;
            }
            // ── INPUT ─────────────────────────────────────────────────────────────
            case 'INPUT': {
                if (!instr.destination)
                    break;
                let inputStr;
                if (this.mockInputQueue.length > 0) {
                    inputStr = this.mockInputQueue.shift();
                }
                else if (this.options?.inputHandler) {
                    inputStr = this.options.inputHandler();
                }
                else {
                    throw new OneVMError('E5012', `Input stream exhausted: no mock inputs or input handler available`, this.pc - 1, this.getStackTrace());
                }
                this.storeVar(instr.destination, inputStr);
                break;
            }
            // ── CALL ──────────────────────────────────────────────────────────────
            case 'CALL': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                if (this.callStack.length >= this.maxCallDepth) {
                    throw new OneVMError('E5006', `Maximum call depth exceeded (stack overflow: ${this.maxCallDepth} frames)`, this.pc - 1, this.getStackTrace());
                }
                const calleeOperand = instr.sources[0];
                let calleeVal = undefined;
                let isCalleeValResolved = false;
                // Resolve argument values from current frame
                const argValues = [];
                for (let i = 1; i < instr.sources.length; i++) {
                    argValues.push(this.loadOperand(instr.sources[i]));
                }
                // Case 1: Callee is a register (indirect call from an expression)
                if (calleeOperand.kind === 'register') {
                    calleeVal = this.loadOperand(calleeOperand);
                    isCalleeValResolved = true;
                }
                // Case 2: Callee is a variable: check if bound in locals, cells, capturedEnv, or globals
                let calleeName = '';
                if (calleeOperand.kind === 'variable') {
                    calleeName = String(calleeOperand.value);
                    const currentFrame = this.callStack.length > 0
                        ? this.callStack[this.callStack.length - 1]
                        : null;
                    const hasLocal = currentFrame && (currentFrame.locals.has(calleeName) || currentFrame.cells.has(calleeName));
                    const hasCaptured = currentFrame?.capturedEnv?.has(calleeName);
                    const hasGlobal = this.globals.has(calleeName);
                    if (hasLocal || hasCaptured || hasGlobal) {
                        calleeVal = this.loadVar(calleeOperand);
                        isCalleeValResolved = true;
                    }
                }
                // If callee value resolved from variable or register:
                if (isCalleeValResolved) {
                    if (isVMClosure(calleeVal)) {
                        if (calleeVal.isAsync) {
                            const promise = {
                                __isPromise: true,
                                id: this.nextPromiseId++,
                                state: 'pending',
                                value: null,
                                onSettled: [],
                            };
                            this.setDest(instr.destination, promise);
                            const taskId = this.nextTaskId++;
                            const taskFrame = {
                                fnName: calleeVal.name || calleeName || '<async closure>',
                                returnPC: this.instructions.length,
                                locals: new Map(),
                                cells: new Map(),
                                capturedEnv: calleeVal.capturedEnv,
                                registers: new Map(),
                                operandStack: [],
                                returnDestRegister: null,
                            };
                            for (let i = 0; i < calleeVal.paramNames.length; i++) {
                                taskFrame.locals.set(calleeVal.paramNames[i], argValues[i] ?? null);
                            }
                            const newTask = {
                                id: taskId,
                                name: calleeVal.name || `task_${taskId}`,
                                pc: calleeVal.entryPC,
                                callStack: [taskFrame],
                                promise,
                                state: 'runnable',
                            };
                            this.tasks.set(taskId, newTask);
                            this.taskQueue.push(taskId);
                            break;
                        }
                        const newFrame = {
                            fnName: calleeVal.name || calleeName || '<closure>',
                            returnPC: this.pc,
                            locals: new Map(),
                            cells: new Map(),
                            capturedEnv: calleeVal.capturedEnv,
                            registers: new Map(),
                            operandStack: [],
                            returnDestRegister: instr.destination.kind === 'register'
                                ? String(instr.destination.value)
                                : null,
                        };
                        for (let i = 0; i < calleeVal.paramNames.length; i++) {
                            newFrame.locals.set(calleeVal.paramNames[i], argValues[i] ?? null);
                        }
                        this.callStack.push(newFrame);
                        this.pc = calleeVal.entryPC;
                        break;
                    }
                    // Value is not callable: fail closed!
                    throw new OneVMError('E5005', `Cannot call non-function value of type '${typeof calleeVal}'`, this.pc - 1);
                }
                // Case 3: Static user-defined function in functions registry
                const fnDesc = this.functions.get(calleeName);
                if (fnDesc) {
                    const startIdx = instr.metadata?.isMethodCall ? 1 : 0;
                    const actualArgs = argValues.slice(startIdx);
                    if (fnDesc.isAsync) {
                        const promise = {
                            __isPromise: true,
                            id: this.nextPromiseId++,
                            state: 'pending',
                            value: null,
                            onSettled: [],
                        };
                        this.setDest(instr.destination, promise);
                        const taskId = this.nextTaskId++;
                        const taskFrame = {
                            fnName: fnDesc.name,
                            returnPC: this.instructions.length,
                            locals: new Map(),
                            cells: new Map(),
                            registers: new Map(),
                            operandStack: [],
                            returnDestRegister: null,
                        };
                        for (let i = 0; i < fnDesc.paramNames.length; i++) {
                            taskFrame.locals.set(fnDesc.paramNames[i], actualArgs[i] ?? null);
                        }
                        const newTask = {
                            id: taskId,
                            name: fnDesc.name,
                            pc: fnDesc.entryPC,
                            callStack: [taskFrame],
                            promise,
                            state: 'runnable',
                        };
                        this.tasks.set(taskId, newTask);
                        this.taskQueue.push(taskId);
                        break;
                    }
                    const newFrame = {
                        fnName: fnDesc.name,
                        returnPC: this.pc,
                        locals: new Map(),
                        cells: new Map(),
                        registers: new Map(),
                        operandStack: [],
                        returnDestRegister: instr.destination.kind === 'register'
                            ? String(instr.destination.value)
                            : null,
                    };
                    for (let i = 0; i < fnDesc.paramNames.length; i++) {
                        newFrame.locals.set(fnDesc.paramNames[i], actualArgs[i] ?? null);
                    }
                    this.callStack.push(newFrame);
                    this.pc = fnDesc.entryPC;
                    break;
                }
                // Case 4: Builtin standard library function
                if (this.builtins.has(calleeName)) {
                    const builtinFn = this.builtins.get(calleeName);
                    const startIdx = instr.metadata?.isMethodCall ? 1 : 0;
                    const actualArgs = argValues.slice(startIdx);
                    const res = builtinFn(...actualArgs);
                    this.setDest(instr.destination, res !== undefined ? res : null);
                    break;
                }
                // Case 5: Dotted method call fallback: obj.method, Math.sqrt -> sqrt, spatial.get -> get
                if (calleeName.includes('.')) {
                    const parts = calleeName.split('.');
                    const objName = parts[0];
                    const methodName = parts[1];
                    // Check if object is a record in locals, cells, capturedEnv, or globals
                    const currentFrame = this.callStack.length > 0
                        ? this.callStack[this.callStack.length - 1]
                        : null;
                    let objVal = undefined;
                    if (currentFrame?.locals.has(objName))
                        objVal = currentFrame.locals.get(objName);
                    else if (currentFrame?.cells.has(objName))
                        objVal = currentFrame.cells.get(objName).value;
                    else if (currentFrame?.capturedEnv?.has(objName))
                        objVal = currentFrame.capturedEnv.get(objName).value;
                    else if (this.globals.has(objName))
                        objVal = this.globals.get(objName);
                    if (Array.isArray(objVal)) {
                        const actualArgs = instr.metadata?.isMethodCall ? argValues.slice(1) : argValues;
                        if (methodName === 'push') {
                            objVal.push(...actualArgs);
                            this.setDest(instr.destination, objVal.length);
                            break;
                        }
                        if (methodName === 'pop') {
                            const res = objVal.pop();
                            this.setDest(instr.destination, res !== undefined ? res : null);
                            break;
                        }
                    }
                    if (objVal && typeof objVal === 'object' && !Array.isArray(objVal)) {
                        const rec = objVal;
                        if (methodName in rec) {
                            const methodVal = rec[methodName];
                            if (isVMClosure(methodVal)) {
                                if (methodVal.isAsync) {
                                    const promise = {
                                        __isPromise: true,
                                        id: this.nextPromiseId++,
                                        state: 'pending',
                                        value: null,
                                        onSettled: [],
                                    };
                                    this.setDest(instr.destination, promise);
                                    const taskId = this.nextTaskId++;
                                    const actualArgs = instr.metadata?.isMethodCall ? argValues.slice(1) : argValues;
                                    const taskFrame = {
                                        fnName: `${objName}.${methodName}`,
                                        returnPC: this.instructions.length,
                                        locals: new Map(),
                                        cells: new Map(),
                                        capturedEnv: methodVal.capturedEnv,
                                        registers: new Map(),
                                        operandStack: [],
                                        returnDestRegister: null,
                                    };
                                    for (let i = 0; i < methodVal.paramNames.length; i++) {
                                        taskFrame.locals.set(methodVal.paramNames[i], actualArgs[i] ?? null);
                                    }
                                    const newTask = {
                                        id: taskId,
                                        name: `${objName}.${methodName}`,
                                        pc: methodVal.entryPC,
                                        callStack: [taskFrame],
                                        promise,
                                        state: 'runnable',
                                    };
                                    this.tasks.set(taskId, newTask);
                                    this.taskQueue.push(taskId);
                                    break;
                                }
                                const actualArgs = instr.metadata?.isMethodCall ? argValues.slice(1) : argValues;
                                const newFrame = {
                                    fnName: `${objName}.${methodName}`,
                                    returnPC: this.pc,
                                    locals: new Map(),
                                    cells: new Map(),
                                    capturedEnv: methodVal.capturedEnv,
                                    registers: new Map(),
                                    operandStack: [],
                                    returnDestRegister: instr.destination.kind === 'register'
                                        ? String(instr.destination.value)
                                        : null,
                                };
                                for (let i = 0; i < methodVal.paramNames.length; i++) {
                                    newFrame.locals.set(methodVal.paramNames[i], actualArgs[i] ?? null);
                                }
                                this.callStack.push(newFrame);
                                this.pc = methodVal.entryPC;
                                break;
                            }
                        }
                    }
                    if (this.builtins.has(methodName)) {
                        const builtinFn = this.builtins.get(methodName);
                        const startIdx = instr.metadata?.isMethodCall ? 1 : 0;
                        const actualArgs = argValues.slice(startIdx);
                        const res = builtinFn(...actualArgs);
                        this.setDest(instr.destination, res !== undefined ? res : null);
                        break;
                    }
                }
                throw new OneVMError('E5005', `Undefined function '${calleeName}'`, this.pc - 1);
            }
            // ── RETURN ────────────────────────────────────────────────────────────
            case 'RETURN': {
                let returnValue = null;
                if (instr.sources.length > 0) {
                    returnValue = this.loadOperand(instr.sources[0]);
                }
                const currentTask = this.tasks.get(this.currentTaskId);
                // Top-level return terminates program/task execution
                if (this.callStack.length === 0) {
                    this.pc = this.instructions.length;
                    currentTask.state = 'completed';
                    break;
                }
                // Return from root frame of an async task: resolve promise and complete task
                if (this.callStack.length === 1 && currentTask.promise) {
                    this.callStack.pop();
                    currentTask.promise.state = 'resolved';
                    currentTask.promise.value = returnValue;
                    currentTask.state = 'completed';
                    this.notifyPromiseSettled(currentTask.promise);
                    this.pc = this.instructions.length;
                    break;
                }
                const frame = this.callStack.pop();
                this.pc = frame.returnPC;
                // Propagate return value to caller's destination register
                if (frame.returnDestRegister !== null) {
                    if (this.callStack.length === 0) {
                        this.globalRegisters.set(frame.returnDestRegister, returnValue);
                    }
                    else {
                        const callerFrame = this.callStack[this.callStack.length - 1];
                        callerFrame.registers.set(frame.returnDestRegister, returnValue);
                    }
                }
                break;
            }
            // ── AWAIT ─────────────────────────────────────────────────────────────
            case 'AWAIT': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const operandVal = this.loadOperand(instr.sources[0]);
                // Case 1: Operand is not a promise (await 42, await "str", etc.) -> identity unwrap
                if (!isVMPromise(operandVal)) {
                    this.setDest(instr.destination, operandVal);
                    break;
                }
                // Case 2: Promise is already resolved
                if (operandVal.state === 'resolved') {
                    this.setDest(instr.destination, operandVal.value);
                    break;
                }
                // Case 3: Promise is already rejected
                if (operandVal.state === 'rejected') {
                    throw operandVal.error || new OneVMError('E5000', 'Promise rejected', this.pc - 1, this.getStackTrace());
                }
                // Case 4: Promise is pending -> Suspend current task!
                const currentTask = this.tasks.get(this.currentTaskId);
                currentTask.state = 'suspended';
                // Rewind PC so when resumed, it re-executes this AWAIT (now resolved/rejected)
                this.pc = this.pc - 1;
                currentTask.pc = this.pc;
                currentTask.callStack = this.callStack;
                // Attach listener to wake up this task when promise settles
                operandVal.onSettled.push(() => {
                    if (currentTask.state === 'suspended') {
                        currentTask.state = 'runnable';
                    }
                });
                break;
            }
            // ── SPATIAL_OP ────────────────────────────────────────────────────────
            case 'SPATIAL_OP': {
                // Preserved declarative spatial instruction: no-op in computational interpreter
                break;
            }
            // ── FIELD_GET ─────────────────────────────────────────────────────────
            case 'FIELD_GET': {
                if (!instr.destination || instr.sources.length === 0)
                    break;
                const obj = this.loadOperand(instr.sources[0]);
                const field = instr.metadata?.field || '';
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    const rec = obj;
                    if (!(field in rec)) {
                        throw new OneVMError('E5008', `Field '${field}' not found on object`, this.pc - 1);
                    }
                    this.setDest(instr.destination, rec[field]);
                    break;
                }
                if (Array.isArray(obj) && field === 'length') {
                    this.setDest(instr.destination, obj.length);
                    break;
                }
                if (typeof obj === 'string' && field === 'length') {
                    this.setDest(instr.destination, obj.length);
                    break;
                }
                throw new OneVMError('E5003', `Cannot read property '${field}' of non-object`, this.pc - 1);
            }
            // ── FIELD_SET ─────────────────────────────────────────────────────────
            case 'FIELD_SET': {
                if (instr.sources.length < 2)
                    break;
                const obj = this.loadOperand(instr.sources[0]);
                const val = this.loadOperand(instr.sources[1]);
                const field = instr.metadata?.field || '';
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    const rec = obj;
                    if (rec.__isEnum) {
                        throw new OneVMError('E5010', 'Cannot mutate enum variant: enums are immutable', this.pc - 1);
                    }
                    if (rec.__declaredFields && !rec.__declaredFields.has(field)) {
                        throw new OneVMError('E5008', `Cannot assign undeclared field '${field}' on sealed struct '${rec.__structName}'`, this.pc - 1);
                    }
                    rec[field] = val;
                    break;
                }
                throw new OneVMError('E5003', `Cannot set property '${field}' on non-object`, this.pc - 1);
            }
            // ── INDEX_GET ─────────────────────────────────────────────────────────
            case 'INDEX_GET': {
                if (!instr.destination || instr.sources.length < 2)
                    break;
                const target = this.loadOperand(instr.sources[0]);
                const idxVal = this.loadOperand(instr.sources[1]);
                const idx = Number(idxVal);
                if (Array.isArray(target)) {
                    if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
                        throw new OneVMError('E5009', `Array index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
                    }
                    this.setDest(instr.destination, target[idx]);
                    break;
                }
                if (typeof target === 'string') {
                    if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
                        throw new OneVMError('E5009', `String index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
                    }
                    this.setDest(instr.destination, target.charAt(idx));
                    break;
                }
                throw new OneVMError('E5003', `Cannot index non-indexable value`, this.pc - 1);
            }
            // ── INDEX_SET ─────────────────────────────────────────────────────────
            case 'INDEX_SET': {
                if (instr.sources.length < 3)
                    break;
                const target = this.loadOperand(instr.sources[0]);
                const idxVal = this.loadOperand(instr.sources[1]);
                const val = this.loadOperand(instr.sources[2]);
                const idx = Number(idxVal);
                if (Array.isArray(target)) {
                    if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
                        throw new OneVMError('E5009', `Array index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
                    }
                    target[idx] = val;
                    break;
                }
                throw new OneVMError('E5003', `Cannot index-assign into non-array value`, this.pc - 1);
            }
            default: {
                throw new OneVMError('E5002', `Unknown opcode '${instr.opcode}'`, this.pc - 1);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Variable Access & Storage
    // ─────────────────────────────────────────────────────────────────────────
    loadVar(op) {
        const name = op.value;
        if (this.callStack.length > 0) {
            const frame = this.callStack[this.callStack.length - 1];
            if (frame.cells.has(name))
                return frame.cells.get(name).value;
            if (frame.locals.has(name))
                return frame.locals.get(name);
            if (frame.capturedEnv && frame.capturedEnv.has(name)) {
                return frame.capturedEnv.get(name).value;
            }
        }
        if (this.globals.has(name))
            return this.globals.get(name);
        if (this.functions.has(name)) {
            const fnDesc = this.functions.get(name);
            return {
                __isClosure: true,
                name: fnDesc.name,
                entryPC: fnDesc.entryPC,
                paramNames: fnDesc.paramNames,
                capturedEnv: new Map(),
                isAsync: fnDesc.isAsync,
            };
        }
        throw new OneVMError('E5004', `Undefined variable '${name}'`, this.pc - 1);
    }
    storeVar(dest, value) {
        const name = dest.value;
        let typedVal = value;
        if (dest.type) {
            const t = dest.type.toLowerCase();
            if (t === 'i32' || t === 'int32' || t === 'int') {
                typedVal = toI32(value);
            }
            else if (t === 'f32' || t === 'float32' || t === 'float') {
                typedVal = toF32(value);
            }
            else if (t === 'bool' || t === 'boolean') {
                typedVal = toBool(value);
            }
        }
        if (this.callStack.length > 0) {
            const frame = this.callStack[this.callStack.length - 1];
            if (frame.cells.has(name)) {
                frame.cells.get(name).value = typedVal;
                frame.locals.set(name, typedVal);
                return;
            }
            if (frame.locals.has(name)) {
                frame.locals.set(name, typedVal);
                return;
            }
            if (frame.capturedEnv && frame.capturedEnv.has(name)) {
                frame.capturedEnv.get(name).value = typedVal;
                return;
            }
            if (this.globals.has(name)) {
                this.globals.set(name, typedVal);
                return;
            }
            frame.locals.set(name, typedVal);
        }
        else {
            this.globals.set(name, typedVal);
        }
    }
    loadOperand(op) {
        switch (op.kind) {
            case 'constant':
                return op.value;
            case 'register': {
                const regName = op.value;
                if (this.callStack.length > 0) {
                    const frame = this.callStack[this.callStack.length - 1];
                    if (frame.registers.has(regName))
                        return frame.registers.get(regName);
                }
                if (this.globalRegisters.has(regName))
                    return this.globalRegisters.get(regName);
                throw new OneVMError('E5004', `Undefined register '${regName}'`, this.pc - 1);
            }
            case 'variable':
                return this.loadVar(op);
            case 'label':
                return 0;
            default:
                return null;
        }
    }
    resolveConstantOperand(op) {
        if (op.kind === 'constant')
            return op.value;
        return this.loadOperand(op);
    }
    setDest(dest, value) {
        const name = dest.value;
        if (dest.kind === 'register') {
            if (this.callStack.length > 0) {
                const frame = this.callStack[this.callStack.length - 1];
                frame.registers.set(name, value);
            }
            else {
                this.globalRegisters.set(name, value);
            }
        }
        else if (dest.kind === 'variable') {
            this.storeVar(dest, value);
        }
    }
    numOperand(op, instr) {
        const val = this.loadOperand(op);
        if (typeof val !== 'number') {
            throw new OneVMError('E5003', `Expected numeric operand for arithmetic opcode but got ${typeof val} (value: ${val})`, this.pc - 1);
        }
        return val;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Resolution Helpers
    // ─────────────────────────────────────────────────────────────────────────
    resolveLabel(labelName, instr) {
        const targetPC = this.labels.get(labelName);
        if (targetPC === undefined) {
            throw new OneVMError('E5002', `Undefined label '${labelName}'`, this.pc - 1);
        }
        return targetPC;
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
    formatValue(value) {
        if (value === null)
            return 'null';
        if (Array.isArray(value))
            return '[' + value.map((v) => this.formatValue(v)).join(', ') + ']';
        if (typeof value === 'object') {
            if (isVMClosure(value)) {
                return `<Closure ${value.name}>`;
            }
            if (isVMPromise(value)) {
                return `<Promise [${value.state}]>`;
            }
            return JSON.stringify(value);
        }
        return String(value);
    }
    areValuesEqual(a, b) {
        if (a === b)
            return true;
        if (a === null || b === null || a === undefined || b === undefined)
            return false;
        if (isVMClosure(a) || isVMClosure(b) || isVMPromise(a) || isVMPromise(b)) {
            return a === b;
        }
        if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
            const recA = a;
            const recB = b;
            if (recA.__structName && recB.__structName && recA.__structName !== recB.__structName) {
                return false;
            }
            const keysA = Object.keys(recA);
            const keysB = Object.keys(recB);
            if (keysA.length !== keysB.length)
                return false;
            for (const k of keysA) {
                if (!this.areValuesEqual(recA[k], recB[k]))
                    return false;
            }
            return true;
        }
        return false;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Public Diagnostic & Inspection API
    // ─────────────────────────────────────────────────────────────────────────
    getGlobals() {
        return this.globals;
    }
    getCallDepth() {
        return this.callStack.length;
    }
    getStackTrace() {
        return this.callStack.map((f, idx) => `[#${idx}] ${f.fnName} (return to PC ${f.returnPC})`);
    }
    getMaxCallDepth() {
        return this.maxCallDepth;
    }
    getMaxInstructions() {
        return this.maxInstructions;
    }
    getFunctionRegistry() {
        return this.functions;
    }
    getLabelIndex() {
        return this.labels;
    }
}
