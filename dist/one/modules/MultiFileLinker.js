import { createVariable, createLabel, } from '../ir/UnifiedIR';
export class MultiFileLinker {
    /**
     * Links topologically sorted modules into a unified IR program.
     * Modules are sorted dependencies-first, with the entry point last.
     */
    static link(sortedModules, moduleIRs, entryPointPath) {
        const rawInstructions = [];
        let regCounter = 20000;
        const nextReg = () => {
            return { kind: 'register', value: `_link_${regCounter++}` };
        };
        const entryMod = sortedModules.find(m => m.filePath === entryPointPath);
        // 1. Emit dependency modules' instructions first
        for (const mod of sortedModules) {
            if (mod.filePath === entryPointPath)
                continue;
            const ir = moduleIRs.get(mod.filePath);
            if (!ir)
                continue;
            for (const instr of ir.instructions) {
                rawInstructions.push({ ...instr });
            }
        }
        // 2. Register aliased function headers for namespace imports
        // E.g. If main imports "./math" as Math, emit alias header for Math.<fn>
        if (entryMod) {
            for (const imp of entryMod.importedModules) {
                if (imp.isNamespace && imp.alias) {
                    const depMod = sortedModules.find(m => m.filePath === imp.resolvedPath);
                    const depIR = depMod ? moduleIRs.get(depMod.filePath) : undefined;
                    if (depMod && depIR) {
                        const aliasPrefix = imp.alias;
                        // Find all function headers in depIR
                        for (let i = 0; i < depIR.instructions.length; i++) {
                            const instr = depIR.instructions[i];
                            if (instr.opcode === 'CONST' && instr.metadata?.isFunctionHeader) {
                                const origFnName = instr.metadata.name;
                                const params = instr.metadata.params || [];
                                const isAsync = Boolean(instr.metadata.isAsync);
                                const aliasEndLabel = `func_end_${aliasPrefix}_${origFnName}`;
                                // Emit an alias function header pointing to the forward jump
                                rawInstructions.push({
                                    index: 0,
                                    opcode: 'CONST',
                                    destination: createLabel(`func_${aliasPrefix}_${origFnName}`),
                                    sources: [],
                                    metadata: {
                                        isFunctionHeader: true,
                                        name: `${aliasPrefix}.${origFnName}`,
                                        params,
                                        isAsync,
                                        endLabel: aliasEndLabel,
                                    },
                                });
                                // Jump directly to the original function entry
                                rawInstructions.push({
                                    index: 0,
                                    opcode: 'JUMP',
                                    destination: createLabel(`func_${origFnName}`),
                                    sources: [],
                                });
                                // Emit alias end label
                                rawInstructions.push({
                                    index: 0,
                                    opcode: 'CONST',
                                    destination: createLabel(aliasEndLabel),
                                    sources: [],
                                    metadata: {
                                        isLabel: true,
                                        isFunctionEnd: true,
                                        name: `${aliasPrefix}.${origFnName}`,
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }
        // 3. Initialize namespace objects for modules imported with `as <Alias>`
        if (entryMod) {
            for (const imp of entryMod.importedModules) {
                if (imp.isNamespace && imp.alias) {
                    const depMod = sortedModules.find(m => m.filePath === imp.resolvedPath);
                    if (depMod) {
                        const aliasName = imp.alias;
                        const keys = [];
                        const valRegs = [];
                        for (const [symName, info] of depMod.exportedSymbols.entries()) {
                            keys.push(symName);
                            const varReg = nextReg();
                            rawInstructions.push({
                                index: 0,
                                opcode: 'LOAD',
                                destination: varReg,
                                sources: [createVariable(symName)],
                            });
                            valRegs.push(varReg);
                        }
                        // Create object record for the namespace: aliasName = { ... }
                        const objReg = nextReg();
                        rawInstructions.push({
                            index: 0,
                            opcode: 'CONST',
                            destination: objReg,
                            sources: valRegs,
                            metadata: { isObjectLiteral: true, keys },
                        });
                        rawInstructions.push({
                            index: 0,
                            opcode: 'STORE',
                            destination: createVariable(aliasName),
                            sources: [objReg],
                        });
                    }
                }
            }
        }
        // 4. Append entry point instructions
        const entryIR = moduleIRs.get(entryPointPath);
        if (entryIR) {
            for (const instr of entryIR.instructions) {
                rawInstructions.push({ ...instr });
            }
        }
        // 5. Re-index all instructions sequentially
        for (let i = 0; i < rawInstructions.length; i++) {
            rawInstructions[i].index = i;
        }
        return {
            version: '1.0.0',
            instructions: rawInstructions,
        };
    }
}
