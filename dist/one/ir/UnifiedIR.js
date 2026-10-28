export function createRegister(id, type) {
    return { kind: 'register', value: `r${id}`, type };
}
export function createVariable(name, type) {
    return { kind: 'variable', value: name, type };
}
export function createConstant(value, type) {
    return { kind: 'constant', value, type };
}
export function createLabel(name) {
    return { kind: 'label', value: name };
}
export function createSpatialPayload(payload) {
    return { kind: 'spatial_payload', value: payload };
}
