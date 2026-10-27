export type IROpcode =
  | 'CONST'
  | 'LOAD'
  | 'STORE'
  | 'MOVE'
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'MOD'
  | 'CMP'
  | 'EQ'
  | 'NE'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  | 'CALL'
  | 'RETURN'
  | 'JUMP'
  | 'JUMP_IF'
  | 'JUMP_IF_FALSE'
  | 'PRINT'
  | 'SPATIAL_OP'
  | 'FIELD_GET'
  | 'FIELD_SET'
  | 'INDEX_GET'
  | 'INDEX_SET'
  | 'MAKE_CLOSURE'
  | 'AWAIT';

export type IROperandKind =
  | 'register'
  | 'variable'
  | 'constant'
  | 'label'
  | 'spatial_payload';

export interface IROperand {
  kind: IROperandKind;
  value: string | number | boolean | null | Record<string, unknown>;
  type?: string;
}

export interface IRInstruction {
  index: number;
  opcode: IROpcode;
  destination?: IROperand;
  sources: IROperand[];
  metadata?: Record<string, unknown>;
}

export interface UnifiedIRProgram {
  version: string;
  instructions: IRInstruction[];
  declarativeMetadata?: {
    rssMaxLimitMB: number;
    assertRssLimitMB?: number;
    actuationLock?: boolean;
  };
}

export function createRegister(id: number, type?: string): IROperand {
  return { kind: 'register', value: `r${id}`, type };
}

export function createVariable(name: string, type?: string): IROperand {
  return { kind: 'variable', value: name, type };
}

export function createConstant(value: number | string | boolean | null, type?: string): IROperand {
  return { kind: 'constant', value, type };
}

export function createLabel(name: string): IROperand {
  return { kind: 'label', value: name };
}

export function createSpatialPayload(payload: Record<string, unknown>): IROperand {
  return { kind: 'spatial_payload', value: payload };
}
