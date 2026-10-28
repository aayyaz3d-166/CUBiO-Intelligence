/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGCanonicalizer
 * Specification: VIG Phase 1 Minimal Architecture Design (Gate VIG-01)
 *
 * Deterministic SHA-256 canonicalization, path normalization,
 * content normalization, and Merkle root sealing for VIG objects.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VIGValidationError } from './types';
export class VIGCanonicalizer {
    /**
     * Normalizes a filesystem path relative to the repository root.
     * Converts all Windows backslashes to forward slashes, strips leading/trailing
     * separators, collapses redundant segments, resolves parent (..) and current (.) segments,
     * prevents root escape, and canonicalizes Windows case aliases against the disk.
     */
    static normalizePath(rawPath, repoRoot) {
        if (!rawPath || typeof rawPath !== 'string') {
            return '';
        }
        let p = rawPath.trim();
        // If absolute path starting with repoRoot (or process.cwd()), strip the prefix
        const effectiveRoot = repoRoot || (path.isAbsolute(rawPath) ? process.cwd() : undefined);
        if (effectiveRoot) {
            const normalizedRoot = effectiveRoot.replace(/\\/g, '/').replace(/\/+$/, '');
            const normalizedP = p.replace(/\\/g, '/');
            if (normalizedP.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
                p = normalizedP.slice(normalizedRoot.length);
            }
        }
        // Convert Windows backslashes to standard forward slashes
        p = p.replace(/\\/g, '/');
        // Strip leading drive letter if remaining (e.g. 'F:/' or 'f:/')
        p = p.replace(/^[a-zA-Z]:\/?/, '');
        // Collapse multiple consecutive slashes
        p = p.replace(/\/+/g, '/');
        // Split and resolve relative segments ('.' and '..')
        const rawSegments = p.split('/');
        const resolvedSegments = [];
        for (const seg of rawSegments) {
            if (seg === '' || seg === '.') {
                continue;
            }
            if (seg === '..') {
                if (resolvedSegments.length === 0) {
                    throw new VIGValidationError(`Path attempts to escape repository root: "${rawPath}"`);
                }
                resolvedSegments.pop();
            }
            else {
                resolvedSegments.push(seg);
            }
        }
        let normalized = resolvedSegments.join('/');
        // Windows Case Aliasing & Canonical Disk Resolution:
        // On Windows (win32), resolve to canonical on-disk casing if file/directory exists
        if (process.platform === 'win32' && normalized.length > 0) {
            try {
                const baseDir = repoRoot ? path.resolve(repoRoot) : process.cwd();
                const candidateAbs = path.resolve(baseDir, normalized);
                if (fs.existsSync(candidateAbs)) {
                    const real = fs.realpathSync.native(candidateAbs);
                    const normBase = baseDir.replace(/\\/g, '/').replace(/\/+$/, '');
                    const normReal = real.replace(/\\/g, '/');
                    if (normReal.toLowerCase().startsWith(normBase.toLowerCase())) {
                        const rel = normReal.slice(normBase.length).replace(/^\/+/, '');
                        if (rel.length > 0) {
                            normalized = rel;
                        }
                    }
                }
            }
            catch {
                // Fallback to normalized segment path if filesystem access is restricted
            }
        }
        return normalized;
    }
    /**
     * Normalizes source text to standard LF line endings with a single trailing newline.
     */
    static normalizeContent(content) {
        let str;
        if (typeof content === 'string') {
            str = content;
        }
        else if (Buffer.isBuffer(content)) {
            str = content.toString('utf8');
        }
        else {
            str = new TextDecoder('utf8').decode(content);
        }
        // Replace all CRLF and CR with LF
        str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Ensure single trailing newline if non-empty
        if (str.length > 0 && !str.endsWith('\n')) {
            str += '\n';
        }
        return str;
    }
    /**
     * Normalizes line endings to LF without forcing trailing newline modifications.
     */
    static normalizeLineEndings(content) {
        if (!content || typeof content !== 'string')
            return '';
        return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    /**
     * Computes the SHA-256 hex digest of normalized content.
     */
    static computeContentHash(content) {
        const normalized = VIGCanonicalizer.normalizeContent(content);
        return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    }
    /**
     * Recursively sorts all keys in an object or array to ensure deterministic property ordering.
     * Omits undefined values to guarantee canonical consistency.
     */
    static sortKeysRecursively(val) {
        if (val === null || typeof val !== 'object') {
            return val;
        }
        if (Array.isArray(val)) {
            return val.map((item) => VIGCanonicalizer.sortKeysRecursively(item));
        }
        const obj = val;
        const sortedKeys = Object.keys(obj).sort();
        const result = {};
        for (const key of sortedKeys) {
            if (obj[key] !== undefined) {
                result[key] = VIGCanonicalizer.sortKeysRecursively(obj[key]);
            }
        }
        return result;
    }
    /**
     * Serializes an object or value to a deterministic canonical JSON string
     * with lexicographically sorted keys at all nested levels.
     */
    static canonicalizeJson(value, pretty = false) {
        const sorted = VIGCanonicalizer.sortKeysRecursively(value);
        return pretty ? JSON.stringify(sorted, null, 2) : JSON.stringify(sorted);
    }
    /**
     * Recursively canonicalizes a metadata dictionary by lexicographically sorting all keys.
     */
    static canonicalizeMetadata(metadata) {
        return VIGCanonicalizer.canonicalizeJson(metadata);
    }
    /**
     * Computes the SHA-256 hex digest of a canonical JSON serialization or payload.
     */
    static computeCanonicalHash(value) {
        const canonical = typeof value === 'string' ? value : VIGCanonicalizer.canonicalizeJson(value);
        return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
    }
    /**
     * Computes the deterministic SHA-256 Content ID (CID) for a VIGNode.
     * CID = sha256(kind + ':' + normalizedPath + ':' + name + ':' + contentHash)
     */
    static computeNodeCID(kind, normalizedPath, name, contentHash) {
        const payload = `${kind}:${normalizedPath}:${name}:${contentHash}`;
        return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    }
    /**
     * Computes the deterministic SHA-256 Edge ID for a VIGEdge.
     * EdgeId = sha256(sourceCid + ':' + relation + ':' + targetCid)
     */
    static computeEdgeId(sourceCid, relation, targetCid) {
        const payload = `${sourceCid}:${relation}:${targetCid}`;
        return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    }
    /**
     * Computes a deterministic Merkle root seal over sorted node CIDs and edge IDs.
     */
    static computeGraphSeal(nodes, edges) {
        const sortedNodeCids = nodes.map((n) => n.cid).slice().sort();
        const sortedEdgeIds = edges.map((e) => e.edgeId).slice().sort();
        const payload = `${sortedNodeCids.join(';')}|${sortedEdgeIds.join(';')}`;
        return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    }
    /**
     * Validates whether a string is a 64-character lowercase hex digest.
     */
    static isValidCID(cid) {
        return typeof cid === 'string' && /^[a-f0-9]{64}$/.test(cid);
    }
    /**
     * Validates CanonicalAddress369 bounds [0..368] (symbolic 0..25, spatial 26..368).
     */
    static isValidSpatialAddress(addr) {
        if (addr === undefined)
            return true;
        return Number.isInteger(addr) && addr >= 0 && addr <= 368;
    }
}
