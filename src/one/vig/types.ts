/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/types
 * Specification: VIG Phase 1 Minimal Architecture Design (Gate VIG-01)
 *
 * Core type definitions, node schemas, edge relations, and error classes
 * for native content-addressed intelligence graph operations.
 */

// ── Node Kinds ──────────────────────────────────────────────────────────────

export type VIGNodeKind =
  | 'SOURCE_FILE'       // Physical source file (.ts, .one, .json)
  | 'MODULE'            // Logical TypeScript / ONE module boundary
  | 'AST_DECLARATION'   // Function, Class, Interface, TypeAlias declaration
  | 'TEST_SUITE'        // Registered automated test file or test runner
  | 'COMMIT_ANCHOR'     // Git commit snapshot binding
  | 'VERIFICATION_RUN'  // Execution evidence record (tsc, tests)
  | 'SPATIAL_ANCHOR';   // Canonical Address369 reference ([0..368])

// ── Edge Relations ──────────────────────────────────────────────────────────

export type VIGRelationType =
  | 'IMPORTS'                 // Module imports another module/file
  | 'CALLS'                   // Function/method calls another symbol
  | 'EXTENDS_OR_IMPLEMENTS'   // Class/interface inheritance
  | 'DEFINES_SYMBOL'          // Source file contains declaration node
  | 'TESTS_MODULE'            // Test suite exercises a production module
  | 'DERIVED_FROM_COMMIT'     // Index node bound to active Git commit
  | 'MAPS_TO_SPATIAL_CELL';   // Node associates with Canonical Address369

// ── Source Location ─────────────────────────────────────────────────────────

export interface VIGSourceLocation {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

// ── VIG Node Model ──────────────────────────────────────────────────────────

export interface VIGNode {
  /** Deterministic SHA-256 Content ID (64-character lowercase hex string) */
  readonly cid: string;

  /** High-level node classification */
  readonly kind: VIGNodeKind;

  /** Relative normalized path from repository root (e.g. 'src/one/tensor/Tensor.ts') */
  readonly path: string;

  /** Qualified symbol or entity name (e.g. 'Tensor.matmul' or 'runESMRuntimeTests') */
  readonly name: string;

  /** SHA-256 hash of the normalized source text or AST payload */
  readonly contentHash: string;

  /** Schema version number (default: 1) */
  readonly version: number;

  /** Exact source span location if applicable */
  readonly location?: VIGSourceLocation;

  /** Whether this node defines a public export consumed across module boundaries */
  readonly isExported: boolean;

  /** Optional foreign key mapping to Canonical Address369 [0..368] */
  readonly spatialAddress?: number;

  /** Structured, schema-validated node attributes */
  readonly metadata: Readonly<Record<string, unknown>>;

  /** Timestamp when node was indexed (epoch milliseconds) */
  readonly indexedAt: number;
}

// ── VIG Edge Model ──────────────────────────────────────────────────────────

export interface VIGEdge {
  /** Deterministic Edge ID: sha256(sourceCid + ':' + relation + ':' + targetCid) */
  readonly edgeId: string;

  /** Dependent / consumer node CID (the entity that has the dependency) */
  readonly sourceCid: string;

  /** Dependency / provider node CID (the entity being depended upon) */
  readonly targetCid: string;

  /** Directed relationship classification */
  readonly relation: VIGRelationType;

  /** Whether changes to the target symbol break public contracts for the source */
  readonly isPublicApi: boolean;

  /** Optional edge metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ── Serialized Graph Data Model ─────────────────────────────────────────────

export interface SerializeOptions {
  /** Optional explicit timestamp for runtime metadata records */
  readonly serializedAt?: number;
  /** Whether to inject current Date.now() timestamp into runtime metadata */
  readonly includeTimestamp?: boolean;
}

export interface SerializedVIGGraph {
  readonly schemaVersion: number;
  readonly graphRootSeal: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly VIGNode[];
  readonly edges: readonly VIGEdge[];
  readonly serializedAt?: number;
}

// ── Error Classes ───────────────────────────────────────────────────────────

export class VIGError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VIGError';
  }
}

export class VIGValidationError extends VIGError {
  constructor(message: string) {
    super(`[VIG Validation Error] ${message}`);
    this.name = 'VIGValidationError';
  }
}

export class VIGConflictError extends VIGError {
  constructor(message: string) {
    super(`[VIG Conflict Error] ${message}`);
    this.name = 'VIGConflictError';
  }
}

export class VIGIntegrityError extends VIGError {
  constructor(message: string) {
    super(`[VIG Integrity Error] ${message}`);
    this.name = 'VIGIntegrityError';
  }
}

export class VIGAccessDeniedError extends VIGError {
  constructor(message: string) {
    super(`[VIG Access Denied Error] ${message}`);
    this.name = 'VIGAccessDeniedError';
  }
}

export class VIGSecurityError extends VIGError {
  constructor(message: string) {
    super(`[VIG Security Error] ${message}`);
    this.name = 'VIGSecurityError';
  }
}

export class VIGLockError extends VIGConflictError {
  constructor(message: string) {
    super(`[VIG Lock Error] ${message}`);
    this.name = 'VIGLockError';
  }
}

// ── Phase 3: Impact Analysis & Traversal Types ───────────────────────────────

export type ImpactTraversalMode = 'BFS' | 'DFS';

export interface ImpactTraversalOptions {
  /** Maximum graph traversal depth to prevent runaway exploration (default: 50) */
  readonly maxDepth?: number;
  /** Traversal strategy: Breadth-First or Depth-First (default: 'BFS') */
  readonly mode?: ImpactTraversalMode;
  /** Whether to discover and collect required test suites (default: true) */
  readonly includeTests?: boolean;
}

export interface ImpactReport {
  /** Initial changed node CIDs triggering the impact traversal */
  readonly rootCids: readonly string[];
  /** All transitively affected downstream nodes in discovery order */
  readonly affectedNodes: readonly VIGNode[];
  /** Unique normalized file paths of all affected nodes */
  readonly affectedPaths: readonly string[];
  /** Subset of affected nodes identified as test suites needing re-execution */
  readonly requiredTestSuites: readonly VIGNode[];
  /** Whether any public API export or public boundary was breached */
  readonly isPublicApiBreached: boolean;
  /** Maximum graph depth reached during traversal */
  readonly maxDepthReached: number;
  /** Whether circular dependencies were detected during traversal */
  readonly cycleDetected: boolean;
  /** Detected cycle chains, each containing node CIDs forming a loop */
  readonly cycles: readonly (readonly string[])[];
  /** Traversal execution latency in milliseconds */
  readonly executionTimeMs: number;
}

// ── Phase 3: AST Extraction & Dependency Diagnostics ─────────────────────────

export interface VIGDiagnostic {
  readonly level: 'warning' | 'error' | 'info';
  readonly message: string;
  readonly path: string;
  readonly location?: VIGSourceLocation;
  readonly code?: string;
}

export interface UnresolvedImport {
  readonly sourcePath: string;
  readonly specifier: string;
  readonly reason: string;
  readonly location?: VIGSourceLocation;
}

export interface VIGExtractionOptions {
  /** Repository root path for relative resolution (default: cwd) */
  readonly repoRoot?: string;
  /** Known file path set for local module resolution */
  readonly knownFiles?: ReadonlySet<string>;
  /** Whether to extract intra-file CALLS edges (default: true) */
  readonly extractCalls?: boolean;
  /** Whether to extract EXTENDS_OR_IMPLEMENTS edges (default: true) */
  readonly extractInheritance?: boolean;
  /** Optional resolver to look up target VIGNode for cross-file imports */
  readonly nodeResolver?: (path: string) => VIGNode | undefined;
}

export interface VIGExtractionResult {
  /** All extracted VIG nodes (file, classes, functions, etc.) */
  readonly nodes: readonly VIGNode[];
  /** All extracted directed edges between existing or resolved nodes */
  readonly edges: readonly VIGEdge[];
  /** Module specifiers that could not be resolved to local source nodes */
  readonly unresolvedImports: readonly UnresolvedImport[];
  /** Parse, syntax, or extraction warnings encountered */
  readonly diagnostics: readonly VIGDiagnostic[];
}

// ── Batch 4: Parser Status & Public API Result ──────────────────────────────

export type VIGParseStatus = 'VALID' | 'INVALID' | 'UNKNOWN';

export interface VIGPublicApiResult {
  /** Syntactic validity of the analyzed source file */
  readonly status: VIGParseStatus;
  /**
   * Deterministic SHA-256 hash of public declarations and signatures,
   * or sentinel 'INVALID_PARSE_ERROR' if syntax validation failed.
   */
  readonly publicApiHash: string;
  /** Sorted list of canonical public declaration signatures */
  readonly signatures: readonly string[];
  /** Optional syntax or parse error message */
  readonly error?: string;
  /** Whether the source was extracted using native ONE Language parser */
  readonly isOneLanguage?: boolean;
}

// ── Phase 4: Change Detection & Manifest Types ───────────────────────────────

export type ChangeClassification =
  | 'NO_CHANGE'
  | 'PRIVATE_IMPLEMENTATION_CHANGE'
  | 'PUBLIC_API_SIGNATURE_CHANGE'
  | 'FILE_ADDED'
  | 'FILE_DELETED';

export interface VIGFileManifestEntry {
  /** Normalized repository-relative path (forward slashes) */
  readonly path: string;
  /** Filesystem modification timestamp in milliseconds */
  readonly mtimeMs: number;
  /** Filesystem status change timestamp in milliseconds (NTFS / POSIX ctime) */
  readonly ctimeMs?: number;
  /** Filesystem inode number if available */
  readonly ino?: number;
  /** File size in bytes */
  readonly sizeBytes: number;
  /** Deterministic SHA-256 hash of normalized LF content */
  readonly contentHash: string;
  /** Deterministic File Node CID */
  readonly cid: string;
  /** SHA-256 hash of exported declarations and signatures */
  readonly publicApiHash: string;
  /** Whether this file is classified as a test suite */
  readonly isTest: boolean;
}

export interface VIGManifest {
  /** Schema version (default: 1) */
  readonly schemaVersion: number;
  /** Cryptographic Merkle root seal over sorted file entries */
  readonly manifestRootSeal: string;
  /** Timestamp when manifest was generated */
  readonly indexedAt: number;
  /** Total number of indexed files */
  readonly fileCount: number;
  /** Map of normalized relative path -> file manifest entry */
  readonly files: Readonly<Record<string, VIGFileManifestEntry>>;
}

export interface FileChangeRecord {
  readonly path: string;
  readonly classification: ChangeClassification;
  readonly oldEntry?: VIGFileManifestEntry;
  readonly newEntry?: VIGFileManifestEntry;
  readonly isPublicApiBreached: boolean;
}

export interface ChangeScanInstrumentation {
  /** Total files considered during the scan */
  readonly filesScanned: number;
  /** Number of filesystem stat calls performed */
  readonly statChecks: number;
  /** Actual number of files read from disk for content hashing */
  readonly filesReRead: number;
  /** Scan execution latency in milliseconds */
  readonly scanDurationMs: number;
}

export interface ChangeDetectionResult {
  /** True if zero content changes or file additions/deletions occurred */
  readonly isNoOp: boolean;
  /** Files detected on disk but not in manifest */
  readonly addedFiles: readonly string[];
  /** Files in manifest but missing from disk */
  readonly deletedFiles: readonly string[];
  /** Files whose content hash changed */
  readonly changedFiles: readonly FileChangeRecord[];
  /** Files with matching stat and content */
  readonly unchangedFiles: readonly string[];
  /** Files whose mtime changed but content hash remained identical */
  readonly touchOnlyFiles: readonly string[];
  /** Whether any changed file modified public API contracts */
  readonly isPublicApiBreached: boolean;
  /** Empirical instrumentation metrics for the scan */
  readonly instrumentation: ChangeScanInstrumentation;
}

export interface SelectiveInvalidationResult {
  /** Whether this operation was a genuine zero-work no-op */
  readonly isNoOp: boolean;
  /** CIDs of nodes invalidated or removed */
  readonly invalidatedCids: readonly string[];
  /** Paths of files that were re-indexed */
  readonly reindexedFiles: readonly string[];
  /** CIDs of nodes cleanly removed due to file deletion */
  readonly removedCids: readonly string[];
  /** Downstream dependent nodes affected by the changes */
  readonly affectedDownstreamNodes: readonly VIGNode[];
  /** Test suites required to run for the invalidated set */
  readonly requiredTestSuites: readonly VIGNode[];
  /** Whether public API boundaries were breached */
  readonly isPublicApiBreached: boolean;
  /** Whether manifest was updated and persisted */
  readonly manifestUpdated: boolean;
  /** Execution latency in milliseconds */
  readonly durationMs: number;
}

// ── Phase 5: Provenance & Verification Evidence Types ────────────────────────

export type VIGVerificationStatus =
  | 'VERIFIED_PASS'
  | 'STALE'
  | 'FAILED'
  | 'UNVERIFIED';

export interface VIGCommitAnchor {
  /** 40-character Git commit hash */
  readonly commitSha: string;
  /** Parent commit hash */
  readonly parentSha: string;
  /** Active Git branch */
  readonly branch: string;
  /** Nearest baseline tag */
  readonly baselineTag: string;
  /** Whether the git working tree has uncommitted modifications */
  readonly isWorkingTreeClean: boolean;
  /** Commit timestamp in epoch seconds */
  readonly committedAt: number;
}

export interface VIGTestSuiteRecord {
  /** Repository-relative path to the test suite */
  readonly suitePath: string;
  /** Total number of checks/tests executed or declared */
  readonly totalChecks: number;
  /** Count of passed assertions */
  readonly passedChecks: number;
  /** Count of failed assertions */
  readonly failedChecks: number;
  /** Count of skipped assertions/tests (default: 0) */
  readonly skippedChecks?: number;
  /** Count of blocked assertions/tests (default: 0) */
  readonly blockedChecks?: number;
  /** Process exit code (0 = success) */
  readonly exitCode: number;
  /** Test execution duration in milliseconds */
  readonly durationMs: number;
}

export interface VIGVerificationEvidence {
  /** Deterministic SHA-256 evidence identity derived from commit, graph seal, working tree state, and test results */
  readonly evidenceId: string;
  /** Bound Git commit SHA */
  readonly commitSha: string;
  /** Bound cryptographic graph Merkle seal at time of evaluation */
  readonly graphRootSeal: string;
  /** Whether the Git working tree was clean at evidence recording time */
  readonly isWorkingTreeClean: boolean;
  /** Epoch timestamp when evaluation occurred (metadata only) */
  readonly evaluatedAt: number;
  /** Whether npx tsc --noEmit succeeded with 0 errors */
  readonly typecheckPassed: boolean;
  /** Number of TypeScript diagnostic errors */
  readonly typecheckErrorCount: number;
  /** Records of all executed test suites */
  readonly testSuites: readonly VIGTestSuiteRecord[];
  /** Total count of passed assertions across all suites */
  readonly totalPassedChecks: number;
  /** Total count of failed assertions across all suites */
  readonly totalFailedChecks: number;
  /** Total count of skipped assertions across all suites */
  readonly totalSkippedChecks: number;
  /** Total count of blocked assertions across all suites */
  readonly totalBlockedChecks: number;
  /** Whether both typecheck and meaningful test suites passed cleanly */
  readonly overallPassed: boolean;
  /** Optional bound release ProvenanceMerkleEngine root seal */
  readonly provenanceSeal?: string;
}

export interface VIGEvidenceLedger {
  /** Schema version (default: 1) */
  readonly schemaVersion: number;
  /** Cryptographic Merkle root seal across all sorted evidence records */
  readonly ledgerRootSeal: string;
  /** Immutable ledger of verification evidence records */
  readonly evidenceRecords: readonly VIGVerificationEvidence[];
  /** Timestamp when ledger was updated */
  readonly lastUpdated: number;
}

// ── Phase 6: Security & Access Control Types ────────────────────────────────

export type VIGAgentRole =
  | 'SYSTEM_CORE'      // Internal test runner & compiler: full read/write rights
  | 'ANALYZER_AGENT'   // CUBiO reasoning agent: read-only query access
  | 'EXTERNAL_SKILL';  // Ephemeral tool / plugin: read-only query access

export interface VIGSecurityContext {
  readonly role: VIGAgentRole;
  readonly agentId: string;
  readonly sessionToken?: string;
  readonly issuedAt?: number;
}

export interface VIGLockData {
  readonly lockId: string;
  readonly pid: number;
  readonly agentId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
}

// ── Phase 6: Public Query & Service Contracts ───────────────────────────────

export interface QueryImpactRequest {
  readonly changedPaths: readonly string[];
  readonly maxDepth?: number;
  readonly includeTests?: boolean;
}

export interface QueryImpactResponse {
  readonly isNoOp: boolean;
  readonly changedNodes: readonly VIGNode[];
  readonly affectedModules: readonly VIGNode[];
  readonly requiredTestSuites: readonly string[];
  readonly isPublicApiBreached: boolean;
  readonly analysisLatencyMs: number;
}

export interface GetVerifiedContextRequest {
  readonly targetPath?: string;
  readonly symbolName?: string;
  readonly requireValidEvidence?: boolean;
}

export interface GetVerifiedContextResponse {
  readonly node: VIGNode | null;
  readonly dependencies: readonly VIGNode[];
  readonly dependents: readonly VIGNode[];
  readonly boundCommitSha: string;
  readonly verificationStatus: VIGVerificationStatus;
  readonly lastEvidence?: VIGVerificationEvidence;
}

export interface GraphAnchorResponse {
  readonly rootCID: string;
  readonly commitSha: string;
  readonly baselineTag: string;
  readonly isClean: boolean;
  readonly totalNodes: number;
  readonly totalEdges: number;
}

export interface IVerifiableIntelligenceGraph {
  queryImpact(request: QueryImpactRequest, context?: VIGSecurityContext): Promise<Readonly<QueryImpactResponse>>;
  getVerifiedContext(request: GetVerifiedContextRequest, context?: VIGSecurityContext): Promise<Readonly<GetVerifiedContextResponse>>;
  getGraphAnchor(context?: VIGSecurityContext): Promise<Readonly<GraphAnchorResponse>>;
  updateIndex(context: VIGSecurityContext, options?: { force?: boolean }): Promise<Readonly<SelectiveInvalidationResult>>;
  recordEvidence(context: VIGSecurityContext, evidence: Omit<VIGVerificationEvidence, 'evidenceId'>): Promise<Readonly<VIGVerificationEvidence>>;
}

// ── Phase 8: Native Integration & Runtime Bridge Types ──────────────────────

export interface VIGRuntimeVerificationGate {
  readonly isAllowed: boolean;
  readonly status: VIGVerificationStatus;
  readonly sourcePath: string;
  readonly boundCommitSha: string;
  readonly reason: string;
  readonly warnings: readonly string[];
}

export interface SourceImpactReport {
  readonly sourcePath: string;
  readonly isPublicApiBreached: boolean;
  readonly affectedDownstreamPaths: readonly string[];
  readonly affectedDownstreamNodes: readonly VIGNode[];
  readonly requiredTestSuites: readonly string[];
  readonly analysisDurationMs: number;
}

export interface ModuleVerificationReport {
  readonly modulePath: string;
  readonly status: VIGVerificationStatus;
  readonly boundCommitSha: string;
  readonly isWorkingTreeClean: boolean;
  readonly verifiedAt?: number;
  readonly lastEvidenceId?: string;
  readonly associatedTestSuites: readonly string[];
}

export interface CompilationCacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly totalEntries: number;
  readonly hitRate: number;
}


