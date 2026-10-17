export type TypeKind =
  | 'number'
  | 'i32'
  | 'f32'
  | 'bool'
  | 'string'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'
  | 'function'
  | 'void'
  | 'any';

export interface Type {
  kind: TypeKind;
  elementType?: Type; // For arrays
  paramTypes?: Type[]; // For functions
  returnType?: Type; // For functions
  properties?: Map<string, Type>; // For objects
  name?: string; // e.g. i32, f32, bool, number, etc.
}

export const TypeI32: Type = { kind: 'i32', name: 'i32' };
export const TypeF32: Type = { kind: 'f32', name: 'f32' };
export const TypeBool: Type = { kind: 'bool', name: 'bool' };
export const TypeBoolean: Type = { kind: 'boolean', name: 'boolean' };
export const TypeNumber: Type = { kind: 'number', name: 'number' };
export const TypeString: Type = { kind: 'string', name: 'string' };
export const TypeNull: Type = { kind: 'null', name: 'null' };
export const TypeVoid: Type = { kind: 'void', name: 'void' };
export const TypeAny: Type = { kind: 'any', name: 'any' };

export function isNumericType(t: Type): boolean {
  return t.kind === 'number' || t.kind === 'i32' || t.kind === 'f32';
}

export function isBooleanType(t: Type): boolean {
  return t.kind === 'boolean' || t.kind === 'bool';
}

export function isIntegerType(t: Type): boolean {
  return t.kind === 'i32';
}

export function isFloatType(t: Type): boolean {
  return t.kind === 'f32';
}

export function createArrayType(elementType: Type): Type {
  return { kind: 'array', elementType, name: `${typeToString(elementType)}[]` };
}

export function createFunctionType(paramTypes: Type[], returnType: Type): Type {
  return {
    kind: 'function',
    paramTypes,
    returnType,
    name: `(${paramTypes.map(typeToString).join(', ')}) => ${typeToString(returnType)}`,
  };
}

export function typeToString(t: Type): string {
  if (t.name) return t.name;
  if (t.kind === 'array' && t.elementType) {
    return `${typeToString(t.elementType)}[]`;
  }
  if (t.kind === 'function' && t.paramTypes && t.returnType) {
    return `(${t.paramTypes.map(typeToString).join(', ')}) => ${typeToString(t.returnType)}`;
  }
  return t.kind;
}

export function areTypesEqual(a: Type, b: Type): boolean {
  if (a.kind === 'any' || b.kind === 'any') return true;
  if (isBooleanType(a) && isBooleanType(b)) return true;
  if (a.kind !== b.kind) return false;

  if (a.kind === 'array') {
    if (!a.elementType || !b.elementType) return true;
    return areTypesEqual(a.elementType, b.elementType);
  }

  if (a.kind === 'function') {
    if (!a.paramTypes || !b.paramTypes || !a.returnType || !b.returnType) return true;
    if (a.paramTypes.length !== b.paramTypes.length) return false;
    for (let i = 0; i < a.paramTypes.length; i++) {
      if (!areTypesEqual(a.paramTypes[i], b.paramTypes[i])) return false;
    }
    return areTypesEqual(a.returnType, b.returnType);
  }

  return true;
}

export function isTypeAssignable(target: Type, source: Type): boolean {
  if (target.kind === 'any' || source.kind === 'any') return true;
  if (isBooleanType(target) && isBooleanType(source)) return true;

  if (isNumericType(target) && isNumericType(source)) {
    // Exact match
    if (target.kind === source.kind) return true;

    // Widening: i32 can implicitly widen to f32
    if (target.kind === 'f32' && source.kind === 'i32') return true;

    // Target is generic number: accepts any numeric
    if (target.kind === 'number') return true;

    // Source is generic number (e.g. untyped literal number): can assign to i32 or f32
    if (source.kind === 'number') return true;

    // Narrowing: f32 to i32 is NOT implicitly assignable (requires explicit cast)
    if (target.kind === 'i32' && source.kind === 'f32') return false;

    return false;
  }

  return areTypesEqual(target, source);
}

export function parseTypeString(str?: string): Type {
  if (!str) return TypeAny;

  const normalized = str.trim();
  if (normalized.endsWith('[]')) {
    const inner = normalized.slice(0, -2);
    return createArrayType(parseTypeString(inner));
  }

  switch (normalized.toLowerCase()) {
    case 'i32':
    case 'int32':
    case 'int':
      return TypeI32;

    case 'f32':
    case 'float32':
    case 'float':
      return TypeF32;

    case 'float64':
    case 'number':
      return TypeNumber;

    case 'string':
      return TypeString;

    case 'bool':
      return TypeBool;
    case 'boolean':
      return TypeBoolean;

    case 'void':
      return TypeVoid;

    case 'null':
      return TypeNull;

    default:
      return TypeAny;
  }
}
