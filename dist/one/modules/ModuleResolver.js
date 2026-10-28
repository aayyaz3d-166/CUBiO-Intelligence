import * as path from 'path';
import * as fs from 'fs';
import { VIGSecurityGuard } from '../vig/VIGSecurityGuard';
import { VIGCanonicalizer } from '../vig/VIGCanonicalizer';
export class ModuleResolver {
    projectRoot;
    virtualFiles;
    constructor(options = {}) {
        this.projectRoot = path.resolve(options.projectRoot ?? process.cwd());
        if (options.virtualFiles) {
            if (options.virtualFiles instanceof Map) {
                this.virtualFiles = new Map();
                for (const [k, v] of options.virtualFiles.entries()) {
                    this.virtualFiles.set(VIGCanonicalizer.normalizePath(path.resolve(this.projectRoot, k)), v);
                }
            }
            else {
                this.virtualFiles = new Map();
                for (const k of Object.keys(options.virtualFiles)) {
                    this.virtualFiles.set(VIGCanonicalizer.normalizePath(path.resolve(this.projectRoot, k)), options.virtualFiles[k]);
                }
            }
        }
    }
    getProjectRoot() {
        return this.projectRoot;
    }
    /**
     * Resolves a module specifier from an importer file path.
     * Enforces fail-closed repository root containment and traversal rejection.
     */
    resolve(specifier, importerPath) {
        if (!specifier || typeof specifier !== 'string' || specifier.trim().length === 0) {
            return {
                success: false,
                errorCode: 'E4002',
                error: "Module specifier cannot be empty",
            };
        }
        // 1. Poison null byte check
        if (specifier.includes('\0')) {
            return {
                success: false,
                errorCode: 'E4001',
                error: `[E4001: Security Error] Path traversal attack detected: specifier contains null byte: "${specifier}"`,
            };
        }
        // 2. Reject raw parent traversal outside root
        const rawSegments = specifier.replace(/\\/g, '/').split('/');
        if (rawSegments.includes('..') && !specifier.startsWith('.')) {
            return {
                success: false,
                errorCode: 'E4001',
                error: `[E4001: Security Error] Path traversal outside authorized project root: "${specifier}"`,
            };
        }
        // 3. Resolve target candidate
        const importerDir = path.dirname(path.resolve(this.projectRoot, importerPath));
        const targetCandidate = specifier.startsWith('.')
            ? path.resolve(importerDir, specifier)
            : path.resolve(this.projectRoot, specifier);
        // 4. Enforce repository root containment using VIGSecurityGuard
        try {
            VIGSecurityGuard.assertSafeRepositoryPath(targetCandidate, this.projectRoot);
        }
        catch (err) {
            return {
                success: false,
                errorCode: 'E4001',
                error: `[E4001: Security Error] Path traversal outside authorized project root: "${specifier}" (${err.message})`,
            };
        }
        // 5. File discovery: exact, .one, index.one
        const candidates = [
            targetCandidate,
            targetCandidate.endsWith('.one') ? targetCandidate : `${targetCandidate}.one`,
            path.join(targetCandidate, 'index.one'),
        ];
        for (const candidate of candidates) {
            const norm = VIGCanonicalizer.normalizePath(candidate);
            if (this.virtualFiles && this.virtualFiles.has(norm)) {
                return { success: true, resolvedPath: norm };
            }
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return { success: true, resolvedPath: norm };
            }
        }
        return {
            success: false,
            errorCode: 'E4002',
            error: `[E4002: Module Resolution Error] Module not found: '${specifier}' (resolved candidate '${targetCandidate}')`,
        };
    }
    /**
     * Reads source content for a resolved file path.
     */
    readSource(resolvedPath) {
        const norm = VIGCanonicalizer.normalizePath(resolvedPath);
        if (this.virtualFiles && this.virtualFiles.has(norm)) {
            return this.virtualFiles.get(norm);
        }
        return fs.readFileSync(resolvedPath, 'utf8');
    }
}
