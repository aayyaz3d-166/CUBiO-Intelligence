import { createRegister, createVariable, createConstant, createLabel, createSpatialPayload, } from './UnifiedIR';
export class IRLowering {
    regCounter = 1;
    labelCounter = 1;
    functionDepth = 0;
    instructions = [];
    structRegistry = new Map();
    enumRegistry = new Map();
    loopExitStack = [];
    lower(program) {
        this.regCounter = 1;
        this.labelCounter = 1;
        this.instructions = [];
        this.structRegistry.clear();
        this.enumRegistry.clear();
        this.loopExitStack = [];
        for (const stmt of program.body) {
            this.lowerStatement(stmt);
        }
        return {
            version: '0.1.0-IR',
            instructions: this.instructions,
            declarativeMetadata: program.declarativeMeta,
        };
    }
    nextReg(type) {
        return createRegister(this.regCounter++, type);
    }
    nextLabel(prefix = 'label') {
        return createLabel(`${prefix}_${this.labelCounter++}`);
    }
    emit(opcode, destination, sources = [], metadata) {
        const instr = {
            index: this.instructions.length,
            opcode,
            destination,
            sources,
            metadata,
        };
        this.instructions.push(instr);
        return instr;
    }
    // ── Statement Lowering ─────────────────────────────────────────────────────
    lowerStatement(stmt) {
        switch (stmt.kind) {
            case 'VariableDeclaration':
                this.lowerVariableDeclaration(stmt);
                break;
            case 'FunctionDeclaration':
                this.lowerFunctionDeclaration(stmt);
                break;
            case 'ReturnStatement':
                this.lowerReturnStatement(stmt);
                break;
            case 'IfStatement':
                this.lowerIfStatement(stmt);
                break;
            case 'WhileStatement':
                this.lowerWhileStatement(stmt);
                break;
            case 'ForStatement':
                this.lowerForStatement(stmt);
                break;
            case 'BlockStatement':
                this.lowerBlockStatement(stmt);
                break;
            case 'ExpressionStatement':
                this.lowerExpression(stmt.expression);
                break;
            case 'PrintStatement':
                this.lowerPrintStatement(stmt);
                break;
            case 'BreakStatement':
                if (this.loopExitStack.length > 0) {
                    const exitLabel = this.loopExitStack[this.loopExitStack.length - 1];
                    this.emit('JUMP', exitLabel, []);
                }
                break;
            case 'InputStatement':
                this.emit('INPUT', createVariable(stmt.target), []);
                break;
            case 'StructDeclaration':
                this.lowerStructDeclaration(stmt);
                break;
            case 'EnumDeclaration':
                this.lowerEnumDeclaration(stmt);
                break;
            case 'DeclarativeSpatialNode':
                this.lowerDeclarativeSpatialNode(stmt);
                break;
            case 'ExportStatement':
                if (stmt.declaration) {
                    this.lowerStatement(stmt.declaration);
                }
                break;
            case 'ModuleDeclaration':
            case 'ImportStatement':
                break;
        }
    }
    lowerVariableDeclaration(node) {
        if (node.initializer) {
            const initReg = this.lowerExpression(node.initializer);
            this.emit('STORE', createVariable(node.identifier, node.inferredType), [initReg]);
        }
    }
    lowerFunctionDeclaration(node) {
        const isNested = this.functionDepth > 0;
        this.functionDepth++;
        const fnLabel = createLabel(`func_${node.name}`);
        const endLabel = this.nextLabel(`func_end_${node.name}`);
        this.emit('CONST', fnLabel, [], {
            isFunctionHeader: true,
            isLabel: true,
            name: node.name,
            isAsync: !!node.isAsync,
            params: node.params.map((p) => p.name),
            endLabel: endLabel.value,
            capturedVars: node.capturedVars || [],
        });
        this.lowerBlockStatement(node.body);
        // Default return if not explicit
        this.emit('RETURN', undefined, []);
        this.emit('CONST', endLabel, [], { isLabel: true, isFunctionEnd: true, name: node.name });
        this.functionDepth--;
        if (isNested) {
            this.emit('MAKE_CLOSURE', createVariable(node.name), [], {
                name: node.name,
                isAsync: !!node.isAsync,
                capturedVars: node.capturedVars || [],
            });
        }
    }
    lowerReturnStatement(node) {
        if (node.value) {
            const valReg = this.lowerExpression(node.value);
            this.emit('RETURN', undefined, [valReg]);
        }
        else {
            this.emit('RETURN', undefined, []);
        }
    }
    lowerIfStatement(node) {
        const condReg = this.lowerExpression(node.condition);
        const elseLabel = this.nextLabel('else');
        const endLabel = this.nextLabel('endif');
        this.emit('JUMP_IF', elseLabel, [condReg], { condition: 'false' });
        this.lowerBlockStatement(node.consequent);
        this.emit('JUMP', endLabel, []);
        this.emit('CONST', elseLabel, [], { isLabel: true });
        if (node.alternate) {
            if (node.alternate.kind === 'IfStatement') {
                this.lowerIfStatement(node.alternate);
            }
            else {
                this.lowerBlockStatement(node.alternate);
            }
        }
        this.emit('CONST', endLabel, [], { isLabel: true });
    }
    lowerWhileStatement(node) {
        const startLabel = this.nextLabel('while_start');
        const endLabel = this.nextLabel('while_end');
        this.emit('CONST', startLabel, [], { isLabel: true });
        const condReg = this.lowerExpression(node.condition);
        this.emit('JUMP_IF', endLabel, [condReg], { condition: 'false' });
        this.loopExitStack.push(endLabel);
        this.lowerBlockStatement(node.body);
        this.loopExitStack.pop();
        this.emit('JUMP', startLabel, []);
        this.emit('CONST', endLabel, [], { isLabel: true });
    }
    lowerForStatement(node) {
        const startLabel = this.nextLabel('for_start');
        const endLabel = this.nextLabel('for_end');
        const iterReg = this.lowerExpression(node.iterable);
        this.emit('CONST', startLabel, [], { isLabel: true });
        // Loop header
        const itemReg = this.nextReg();
        this.emit('LOAD', itemReg, [iterReg], {
            iteratorVar: node.iterator,
            endLabel: endLabel.value,
        });
        this.emit('STORE', createVariable(node.iterator), [itemReg]);
        this.loopExitStack.push(endLabel);
        this.lowerBlockStatement(node.body);
        this.loopExitStack.pop();
        this.emit('JUMP', startLabel, []);
        this.emit('CONST', endLabel, [], { isLabel: true });
    }
    lowerBlockStatement(node) {
        for (const stmt of node.statements) {
            this.lowerStatement(stmt);
        }
    }
    lowerPrintStatement(node) {
        const exprReg = this.lowerExpression(node.expression);
        this.emit('PRINT', undefined, [exprReg]);
    }
    lowerDeclarativeSpatialNode(node) {
        this.emit('SPATIAL_OP', undefined, [createSpatialPayload(node.payload)], {
            nodeType: node.nodeType,
        });
    }
    lowerStructDeclaration(node) {
        this.structRegistry.set(node.name, node);
    }
    lowerEnumDeclaration(node) {
        this.enumRegistry.set(node.name, node);
        const dest = this.nextReg('object');
        const keys = [];
        const valRegs = [];
        for (const v of node.variants) {
            keys.push(v.name);
            const valType = typeof v.value === 'string' ? 'string' : 'number';
            const valReg = this.nextReg(valType);
            this.emit('CONST', valReg, [createConstant(v.value, valType)]);
            valRegs.push(valReg);
        }
        this.emit('CONST', dest, valRegs, { isObjectLiteral: true, isEnum: true, enumName: node.name, keys });
        this.emit('STORE', createVariable(node.name), [dest]);
    }
    // ── Expression Lowering ────────────────────────────────────────────────────
    lowerExpression(expr) {
        switch (expr.kind) {
            case 'Literal': {
                const dest = this.nextReg(expr.inferredType);
                this.emit('CONST', dest, [createConstant(expr.value, expr.inferredType)]);
                return dest;
            }
            case 'Identifier': {
                const dest = this.nextReg(expr.inferredType);
                this.emit('LOAD', dest, [createVariable(expr.name, expr.inferredType)]);
                return dest;
            }
            case 'BinaryExpression': {
                // Assignment: obj.key = val  or  arr[i] = val
                if (expr.operator === '=' && expr.left.kind === 'MemberExpression') {
                    const memberNode = expr.left;
                    const objReg = this.lowerExpression(memberNode.object);
                    const valReg = this.lowerExpression(expr.right);
                    if (!memberNode.computed) {
                        // obj.key = val  → FIELD_SET
                        this.emit('FIELD_SET', undefined, [objReg, valReg], {
                            field: memberNode.property,
                        });
                    }
                    else {
                        // arr[i] = val  → INDEX_SET
                        const idxReg = this.lowerExpression(memberNode.property);
                        this.emit('INDEX_SET', undefined, [objReg, idxReg, valReg]);
                    }
                    return valReg;
                }
                // Assignment: x = 10
                if (expr.operator === '=' && expr.left.kind === 'Identifier') {
                    const valReg = this.lowerExpression(expr.right);
                    this.emit('STORE', createVariable(expr.left.name), [valReg]);
                    return valReg;
                }
                const leftReg = this.lowerExpression(expr.left);
                const rightReg = this.lowerExpression(expr.right);
                const dest = this.nextReg(expr.inferredType);
                switch (expr.operator) {
                    case '+':
                        this.emit('ADD', dest, [leftReg, rightReg]);
                        break;
                    case '-':
                        this.emit('SUB', dest, [leftReg, rightReg]);
                        break;
                    case '*':
                        this.emit('MUL', dest, [leftReg, rightReg]);
                        break;
                    case '/':
                        this.emit('DIV', dest, [leftReg, rightReg]);
                        break;
                    case '%':
                        this.emit('MOD', dest, [leftReg, rightReg]);
                        break;
                    case '<':
                    case '<=':
                    case '>':
                    case '>=':
                    case '==':
                    case '!=':
                    case '&&':
                    case '||':
                        this.emit('CMP', dest, [leftReg, rightReg], { operator: expr.operator });
                        break;
                    default:
                        this.emit('MOVE', dest, [leftReg]);
                }
                return dest;
            }
            case 'UnaryExpression': {
                const operandReg = this.lowerExpression(expr.operand);
                const dest = this.nextReg(expr.inferredType);
                if (expr.operator === '-') {
                    const zero = this.nextReg('number');
                    this.emit('CONST', zero, [createConstant(0, 'number')]);
                    this.emit('SUB', dest, [zero, operandReg]);
                }
                else if (expr.operator === '!') {
                    this.emit('CMP', dest, [operandReg], { operator: '!' });
                }
                else {
                    this.emit('MOVE', dest, [operandReg]);
                }
                return dest;
            }
            case 'CallExpression': {
                // Struct constructor call: e.g. Point(10, 20)
                if (expr.callee.kind === 'Identifier') {
                    const struct = this.structRegistry.get(expr.callee.name);
                    if (struct) {
                        const dest = this.nextReg(struct.name);
                        const keys = struct.fields.map((f) => f.name);
                        const valRegs = expr.args.map((a) => this.lowerExpression(a));
                        this.emit('CONST', dest, valRegs, {
                            isObjectLiteral: true,
                            isStruct: true,
                            structName: struct.name,
                            keys,
                        });
                        return dest;
                    }
                }
                // Method call: callee is a MemberExpression → dispatch as "Object.method"
                if (expr.callee.kind === 'MemberExpression') {
                    const calleeNode = expr.callee;
                    const objReg = this.lowerExpression(calleeNode.object);
                    const argRegs = expr.args.map((a) => this.lowerExpression(a));
                    const dest = this.nextReg(expr.inferredType);
                    const methodName = typeof calleeNode.property === 'string'
                        ? calleeNode.property
                        : 'unknown';
                    // Build qualified name for stdlib: "Math.sqrt", "Array.push" etc.
                    let qualifiedName = methodName;
                    if (calleeNode.object.kind === 'Identifier') {
                        qualifiedName = `${calleeNode.object.name}.${methodName}`;
                    }
                    this.emit('CALL', dest, [createVariable(qualifiedName), objReg, ...argRegs], {
                        isMethodCall: true,
                    });
                    return dest;
                }
                // Normal or indirect call: callee can be Identifier or arbitrary expression
                const argRegs = expr.args.map((a) => this.lowerExpression(a));
                const dest = this.nextReg(expr.inferredType);
                if (expr.callee.kind === 'Identifier') {
                    this.emit('CALL', dest, [createVariable(expr.callee.name), ...argRegs]);
                }
                else {
                    const calleeReg = this.lowerExpression(expr.callee);
                    this.emit('CALL', dest, [calleeReg, ...argRegs]);
                }
                return dest;
            }
            case 'FunctionDeclaration': {
                const isNested = this.functionDepth > 0;
                this.functionDepth++;
                const fnLabel = createLabel(`func_${expr.name}`);
                const endLabel = this.nextLabel(`func_end_${expr.name}`);
                this.emit('CONST', fnLabel, [], {
                    isFunctionHeader: true,
                    name: expr.name,
                    isAsync: !!expr.isAsync,
                    params: expr.params.map((p) => p.name),
                    endLabel: endLabel.value,
                    capturedVars: expr.capturedVars || [],
                });
                this.lowerBlockStatement(expr.body);
                // Default return if not explicit
                this.emit('RETURN', undefined, []);
                this.emit('CONST', endLabel, [], { isLabel: true, isFunctionEnd: true, name: expr.name });
                this.functionDepth--;
                const dest = this.nextReg('function');
                this.emit('MAKE_CLOSURE', dest, [], {
                    name: expr.name,
                    isAsync: !!expr.isAsync,
                    capturedVars: expr.capturedVars || [],
                });
                return dest;
            }
            case 'AwaitExpression': {
                const argReg = this.lowerExpression(expr.argument);
                const dest = this.nextReg(expr.inferredType);
                this.emit('AWAIT', dest, [argReg]);
                return dest;
            }
            case 'MemberExpression': {
                const objReg = this.lowerExpression(expr.object);
                const dest = this.nextReg(expr.inferredType);
                if (!expr.computed) {
                    // obj.key → FIELD_GET
                    this.emit('FIELD_GET', dest, [objReg], { field: expr.property });
                }
                else {
                    // arr[i] → INDEX_GET
                    const idxReg = this.lowerExpression(expr.property);
                    this.emit('INDEX_GET', dest, [objReg, idxReg]);
                }
                return dest;
            }
            case 'ArrayLiteral': {
                const elemRegs = expr.elements.map((e) => this.lowerExpression(e));
                const dest = this.nextReg(expr.inferredType);
                this.emit('CONST', dest, elemRegs, { isArrayLiteral: true });
                return dest;
            }
            case 'ObjectLiteral': {
                const dest = this.nextReg(expr.inferredType);
                const keys = [];
                const valRegs = [];
                for (const prop of expr.properties) {
                    keys.push(prop.key);
                    valRegs.push(this.lowerExpression(prop.value));
                }
                this.emit('CONST', dest, valRegs, {
                    isObjectLiteral: true,
                    isStruct: Boolean(expr.structName),
                    structName: expr.structName,
                    keys,
                });
                return dest;
            }
            default: {
                const dest = this.nextReg(expr?.inferredType);
                this.emit('CONST', dest, [createConstant(null)]);
                return dest;
            }
        }
    }
}
