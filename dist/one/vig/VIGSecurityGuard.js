/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGSecurityGuard
 * Specification: VIG Phase 6 Security & Recovery Hardening
 *
 * Runtime role-based access control (RBAC), path traversal protection,
 * repository root containment, and physical actuation lockout enforcement.
 */
import * as crypto from 'crypto';
import * as path from 'path';
import { VIGAccessDeniedError, VIGSecurityError, VIGValidationError, } from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';
export class VIGSecurityGuard {
    static ALLOWED_ROLES = new Set([
        'SYSTEM_CORE',
        'ANALYZER_AGENT',
        'EXTERNAL_SKILL',
    ]);
    static MUTATING_ROLES = new Set([
        'SYSTEM_CORE',
    ]);
    static configuredSystemSecret = null;
    /**
     * Configures the trusted system secret used to authenticate SYSTEM_CORE contexts.
     * Fail-closed: Must be non-empty and at least 16 characters.
     */
    static configureSystemSecret(secret) {
        if (secret === null) {
            this.configuredSystemSecret = null;
            return;
        }
        if (typeof secret !== 'string' || secret.trim().length < 16) {
            throw new VIGValidationError('System secret must be a string of at least 16 characters');
        }
        this.configuredSystemSecret = secret.trim();
    }
    static getSystemSecret() {
        return this.configuredSystemSecret;
    }
    static resetSystemSecret() {
        this.configuredSystemSecret = null;
    }
    /**
     * Mints a cryptographically authenticated session token for a given role and agentId.
     */
    static mintSessionToken(role, agentId, secretKey, options) {
        const key = secretKey ?? this.configuredSystemSecret;
        if (!key) {
            throw new VIGAccessDeniedError('Cannot mint session token: System authentication secret is not configured');
        }
        if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
            throw new VIGValidationError('agentId must be a non-empty string');
        }
        if (!this.ALLOWED_ROLES.has(role)) {
            throw new VIGAccessDeniedError(`Cannot mint session token for invalid role: "${role}"`);
        }
        const issuedAt = options?.issuedAt ?? Date.now();
        const ttlMs = options?.ttlMs ?? 300000; // 5 minutes default
        const expiresAt = issuedAt + ttlMs;
        const nonce = options?.nonce ?? crypto.randomBytes(16).toString('hex');
        const payload = `${role}:${agentId.trim()}:${issuedAt}:${expiresAt}:${nonce}`;
        const signature = crypto.createHmac('sha256', key).update(payload).digest('hex');
        const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
        return `VIG-ST1.${encodedPayload}.${signature}`;
    }
    /**
     * Factory to create an authenticated SYSTEM_CORE security context.
     */
    static createSystemContext(agentId, secretKey, options) {
        const key = secretKey ?? this.configuredSystemSecret;
        if (!key) {
            throw new VIGAccessDeniedError('Cannot create SYSTEM_CORE context: System authentication secret is not configured');
        }
        const token = this.mintSessionToken('SYSTEM_CORE', agentId, key, options);
        const issuedAt = options?.issuedAt ?? Date.now();
        return Object.freeze({
            role: 'SYSTEM_CORE',
            agentId: agentId.trim(),
            sessionToken: token,
            issuedAt,
        });
    }
    static PROHIBITED_ACTUATION_KEYS = [
        'actuate',
        'actuation',
        'physicalaction',
        'hardwareaccess',
        'networkconnect',
        'execcommand',
        'shellexec',
        'overridelockout',
        'physicalactuation',
        'motorcontrol',
        'sensortrigger',
    ];
    /**
     * Validates a security context object at runtime.
     * Fail-closed: does not trust compile-time TypeScript declarations.
     * Enforces cryptographic authentication on SYSTEM_CORE contexts (BUG-D01).
     */
    static validateSecurityContext(context, options) {
        if (!context || typeof context !== 'object') {
            throw new VIGAccessDeniedError('Security context is missing or not an object');
        }
        const ctx = context;
        if (typeof ctx.role !== 'string' || !this.ALLOWED_ROLES.has(ctx.role)) {
            throw new VIGAccessDeniedError(`Invalid security role: "${String(ctx.role)}". Allowed roles are: ${Array.from(this.ALLOWED_ROLES).join(', ')}`);
        }
        if (typeof ctx.agentId !== 'string' || ctx.agentId.trim().length === 0) {
            throw new VIGValidationError('Security context must include a non-empty "agentId"');
        }
        const role = ctx.role;
        const agentId = ctx.agentId.trim();
        // ── BUG-D01: Trusted Identity Boundary for SYSTEM_CORE ───────────────────
        if (role === 'SYSTEM_CORE') {
            const secret = options?.secretKey ?? this.configuredSystemSecret;
            if (!secret) {
                throw new VIGAccessDeniedError('Authentication failed: System secret is not configured; SYSTEM_CORE access rejected fail-closed');
            }
            if (typeof ctx.sessionToken !== 'string' || ctx.sessionToken.trim().length === 0) {
                throw new VIGAccessDeniedError('Authentication failed: Unauthenticated caller claiming SYSTEM_CORE without valid sessionToken');
            }
            const token = ctx.sessionToken.trim();
            const parts = token.split('.');
            if (parts.length !== 3 || parts[0] !== 'VIG-ST1') {
                throw new VIGAccessDeniedError('Authentication failed: Malformed or unversioned sessionToken format');
            }
            const encodedPayload = parts[1];
            const signature = parts[2];
            let decodedPayload = '';
            try {
                decodedPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
            }
            catch {
                throw new VIGAccessDeniedError('Authentication failed: Could not decode sessionToken payload');
            }
            const payloadParts = decodedPayload.split(':');
            if (payloadParts.length !== 5) {
                throw new VIGAccessDeniedError('Authentication failed: Invalid sessionToken payload segments');
            }
            const [tokenRole, tokenAgentId, tokenIssuedAtStr, tokenExpiresAtStr] = payloadParts;
            if (tokenRole !== 'SYSTEM_CORE') {
                throw new VIGAccessDeniedError(`Authentication failed: Token role "${tokenRole}" does not grant SYSTEM_CORE`);
            }
            if (tokenAgentId !== agentId) {
                throw new VIGAccessDeniedError('Authentication failed: Token agentId mismatch (expected context agentId)');
            }
            const tokenIssuedAt = parseInt(tokenIssuedAtStr, 10);
            const tokenExpiresAt = parseInt(tokenExpiresAtStr, 10);
            if (isNaN(tokenIssuedAt) || isNaN(tokenExpiresAt)) {
                throw new VIGAccessDeniedError('Authentication failed: Invalid timestamps in sessionToken');
            }
            const now = Date.now();
            // Clock skew tolerance: 5000ms
            if (now > tokenExpiresAt + 5000) {
                throw new VIGAccessDeniedError('Authentication failed: Session token has expired');
            }
            if (now < tokenIssuedAt - 5000) {
                throw new VIGAccessDeniedError('Authentication failed: Session token used before issue time');
            }
            // Recompute expected HMAC signature
            const expectedSig = crypto.createHmac('sha256', secret).update(decodedPayload).digest('hex');
            let sigMatches = false;
            try {
                sigMatches = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
            }
            catch {
                sigMatches = false;
            }
            if (!sigMatches) {
                throw new VIGAccessDeniedError('Authentication failed: Invalid or forged sessionToken signature');
            }
        }
        return Object.freeze({
            role,
            agentId,
            sessionToken: typeof ctx.sessionToken === 'string' ? ctx.sessionToken : undefined,
            issuedAt: typeof ctx.issuedAt === 'number' ? ctx.issuedAt : undefined,
        });
    }
    /**
     * Asserts that the caller has mutation privileges (SYSTEM_CORE).
     * Throws VIGAccessDeniedError if the role is ANALYZER_AGENT, EXTERNAL_SKILL, or invalid.
     */
    static assertCanMutate(context, operationName) {
        const validated = this.validateSecurityContext(context);
        if (!this.MUTATING_ROLES.has(validated.role)) {
            throw new VIGAccessDeniedError(`Access denied: role "${validated.role}" (agent "${validated.agentId}") is not authorized to execute mutating operation "${operationName}". Only SYSTEM_CORE is permitted.`);
        }
    }
    /**
     * Asserts that the caller has read privileges (SYSTEM_CORE, ANALYZER_AGENT, EXTERNAL_SKILL).
     */
    static assertCanRead(context, operationName) {
        this.validateSecurityContext(context);
    }
    /**
     * Validates that a file path is safely contained within the repository root.
     * Defends against directory traversal (../), poison null bytes, and out-of-root absolute paths.
     */
    static assertSafeRepositoryPath(rawPath, repoRoot) {
        if (!rawPath || typeof rawPath !== 'string') {
            throw new VIGValidationError('File path must be a non-empty string');
        }
        // 1. Poison null byte check
        if (rawPath.includes('\0')) {
            throw new VIGSecurityError(`Path traversal attack detected: path contains poison null byte: "${rawPath}"`);
        }
        // 2. Reject parent traversal segments in raw path
        const rawSegments = rawPath.replace(/\\/g, '/').split('/');
        if (rawSegments.includes('..')) {
            throw new VIGSecurityError(`Path traversal attack detected: path "${rawPath}" contains parent directory segment ".."`);
        }
        // 3. Resolve target against repo root
        const normalizedRepoRoot = path.resolve(repoRoot);
        const resolvedTarget = path.isAbsolute(rawPath)
            ? path.resolve(rawPath)
            : path.resolve(normalizedRepoRoot, rawPath);
        // 4. Containment check via relative path
        const relative = path.relative(normalizedRepoRoot, resolvedTarget);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new VIGSecurityError(`Path traversal attack detected: path "${rawPath}" resolves outside repository root "${repoRoot}"`);
        }
        // 5. Double-check forward-slash normalized segments
        const normalizedPath = VIGCanonicalizer.normalizePath(relative);
        const segments = normalizedPath.split('/');
        if (segments.includes('..')) {
            throw new VIGSecurityError(`Path traversal attack detected: path "${rawPath}" contains parent directory segment ".."`);
        }
        return normalizedPath;
    }
    /**
     * Asserts physical actuation lockout.
     * VIG is strictly a read, static analysis, and verification index.
     * Physical actuation, hardware control, or external execution is forbidden fail-closed.
     */
    static assertNoActuation(payload, operationName) {
        if (!payload || typeof payload !== 'object') {
            return;
        }
        const visited = new Set();
        const checkObject = (obj) => {
            if (!obj || typeof obj !== 'object' || visited.has(obj)) {
                return;
            }
            visited.add(obj);
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                for (const prohibited of VIGSecurityGuard.PROHIBITED_ACTUATION_KEYS) {
                    if (lowerKey === prohibited || lowerKey.includes(prohibited)) {
                        throw new VIGSecurityError(`Actuation lockout violation: operation "${operationName}" contained forbidden actuation key "${key}". VIG prohibits all physical actuation and execution hooks.`);
                    }
                }
                if (typeof value === 'object' && value !== null) {
                    checkObject(value);
                }
            }
        };
        checkObject(payload);
    }
}
