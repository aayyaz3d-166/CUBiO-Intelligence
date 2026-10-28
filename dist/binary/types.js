/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Types & Interfaces (src/binary/types.ts)
 */
export var BitCategory;
(function (BitCategory) {
    BitCategory[BitCategory["TYPE_NULL"] = 0] = "TYPE_NULL";
    BitCategory[BitCategory["TYPE_BOOL"] = 1] = "TYPE_BOOL";
    BitCategory[BitCategory["TYPE_INT"] = 2] = "TYPE_INT";
    BitCategory[BitCategory["TYPE_FLOAT"] = 3] = "TYPE_FLOAT";
    BitCategory[BitCategory["TYPE_TEXT"] = 4] = "TYPE_TEXT";
    BitCategory[BitCategory["TYPE_ADDR369"] = 5] = "TYPE_ADDR369";
    BitCategory[BitCategory["TYPE_OPCODE"] = 6] = "TYPE_OPCODE";
    BitCategory[BitCategory["TYPE_CONTROL"] = 7] = "TYPE_CONTROL";
})(BitCategory || (BitCategory = {}));
export var TriangleOpcode;
(function (TriangleOpcode) {
    // Quartile 0: Core Operations
    TriangleOpcode[TriangleOpcode["OP_NOP"] = 0] = "OP_NOP";
    TriangleOpcode[TriangleOpcode["OP_HALT"] = 1] = "OP_HALT";
    TriangleOpcode[TriangleOpcode["OP_READ"] = 2] = "OP_READ";
    TriangleOpcode[TriangleOpcode["OP_WRITE"] = 3] = "OP_WRITE";
    TriangleOpcode[TriangleOpcode["OP_INSPECT"] = 4] = "OP_INSPECT";
    TriangleOpcode[TriangleOpcode["OP_PUSH"] = 5] = "OP_PUSH";
    TriangleOpcode[TriangleOpcode["OP_POP"] = 6] = "OP_POP";
    TriangleOpcode[TriangleOpcode["OP_SWAP"] = 7] = "OP_SWAP";
    TriangleOpcode[TriangleOpcode["OP_ADD"] = 8] = "OP_ADD";
    TriangleOpcode[TriangleOpcode["OP_SUB"] = 9] = "OP_SUB";
    TriangleOpcode[TriangleOpcode["OP_MUL"] = 10] = "OP_MUL";
    TriangleOpcode[TriangleOpcode["OP_DIV"] = 11] = "OP_DIV";
    TriangleOpcode[TriangleOpcode["OP_MOD"] = 12] = "OP_MOD";
    TriangleOpcode[TriangleOpcode["OP_EQ"] = 13] = "OP_EQ";
    TriangleOpcode[TriangleOpcode["OP_LT"] = 14] = "OP_LT";
    TriangleOpcode[TriangleOpcode["OP_GT"] = 15] = "OP_GT";
    // Quartile 1: Control & Spatial Routing
    TriangleOpcode[TriangleOpcode["OP_JUMP"] = 16] = "OP_JUMP";
    TriangleOpcode[TriangleOpcode["OP_JUMP_IF"] = 17] = "OP_JUMP_IF";
    TriangleOpcode[TriangleOpcode["OP_CALL"] = 18] = "OP_CALL";
    TriangleOpcode[TriangleOpcode["OP_RET"] = 19] = "OP_RET";
    TriangleOpcode[TriangleOpcode["OP_SHELL_ALLOC"] = 20] = "OP_SHELL_ALLOC";
    TriangleOpcode[TriangleOpcode["OP_ENTROPY_EVAL"] = 21] = "OP_ENTROPY_EVAL";
    TriangleOpcode[TriangleOpcode["OP_LOCK_CHECK"] = 22] = "OP_LOCK_CHECK";
    TriangleOpcode[TriangleOpcode["OP_BARRIER"] = 23] = "OP_BARRIER";
    // Quartile 3: Markers
    TriangleOpcode[TriangleOpcode["MARKER_ESCAPE"] = 62] = "MARKER_ESCAPE";
    TriangleOpcode[TriangleOpcode["MARKER_EOS"] = 63] = "MARKER_EOS";
})(TriangleOpcode || (TriangleOpcode = {}));
export class BinaryError extends Error {
    code;
    constructor(code, message) {
        super(`[BinaryError ${code}] ${message}`);
        this.name = 'BinaryError';
        this.code = code;
    }
}
