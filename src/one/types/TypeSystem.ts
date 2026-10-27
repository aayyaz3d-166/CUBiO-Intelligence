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
  | 'struct'
  | 'enum'
  | 'function'
  | 'promise'
  | 'void'
  | 'any';

export interface Type {
  kind: TypeKind;
  elementType?: Type; // For arrays
  paramTypes?: Type[]; // For functions
  returnType?: Type; // For functions
  properties?: Map<string, Type>; // For objects and structs
  structName?: string; // For structs
  enumName?: string; // For enums
  enumVariants?: Map<string, number | string>; // For enums
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

export function createPromiseType(resolved: Type = TypeAny): Type {
  return {
    kind: 'promise',
    elementType: resolved,
    name: `Promise<${resolved.name || 'any'}>`,
  };
}

export function isPromiseType(t: Type): boolean {
  return t.kind === 'promise';
}

export function isFloatType(t: Type): boolean {
  return t.kind === 'f32';
}

export function createArrayType(elementType: Type): Type {
  return { kind: 'array', elementType, name: `${typeToString(elementType)}[]` };
}

export function createStructType(name: string, properties: Map<string, Type>): Type {
  return {
    kind: 'struct',
    name,
    structName: name,
    properties,
  };
}

export function createEnumType(name: string, variants: Map<string, number | string>): Type {
  return {
    kind: 'enum',
    name,
    enumName: name,
    enumVariants: variants,
  };
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

  if (a.kind === 'struct' && b.kind === 'struct') {
    return a.structName === b.structName;
  }

  if (a.kind === 'enum' && b.kind === 'enum') {
    return a.enumName === b.enumName;
  }

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

  if (target.kind === 'struct' && source.kind === 'struct') {
    return target.structName === source.structName;
  }

  if (target.kind === 'struct' && source.kind === 'object' && target.properties && source.properties) {
    for (const [propName, targetPropType] of target.properties.entries()) {
      const sourcePropType = source.properties.get(propName);
      if (!sourcePropType || !isTypeAssignable(targetPropType, sourcePropType)) {
        return false;
      }
    }
    return true;
  }

  if (target.kind === 'enum' && source.kind === 'enum') {
    return target.enumName === source.enumName;
  }

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

export function parseTypeString(str?: string, customTypes?: Map<string, Type>): Type {
  if (!str) return TypeAny;

  const normalized = str.trim();
  if (normalized.endsWith('[]')) {
    const inner = normalized.slice(0, -2);
    return createArrayType(parseTypeString(inner, customTypes));
  }

  if (customTypes && customTypes.has(normalized)) {
    return customTypes.get(normalized)!;
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

    case 'function':
    case 'fn':
      return createFunctionType([], TypeAny);

    default:
      if (normalized.startsWith('promise<') && normalized.endsWith('>')) {
        const inner = normalized.slice(8, -1).trim();
        const resolved = parseTypeString(inner, customTypes);
        return createPromiseType(resolved);
      }
      if (normalized.includes('=>')) {
        const parts = normalized.split('=>');
        const paramsPart = parts[0].trim();
        const retPart = parts[1].trim();
        const paramTypes: Type[] = [];
        if (paramsPart.startsWith('(') && paramsPart.endsWith(')')) {
          const inner = paramsPart.slice(1, -1).trim();
          if (inner) {
            for (const p of inner.split(',')) {
              paramTypes.push(parseTypeString(p.trim(), customTypes));
            }
          }
        } else if (paramsPart) {
          paramTypes.push(parseTypeString(paramsPart, customTypes));
        }
        const retType = parseTypeString(retPart, customTypes);
        return createFunctionType(paramTypes, retType);
      }
      return { kind: 'any', name: normalized };
  }
}
