/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGGraphStore
 * Specification: VIG Phase 1 Minimal Architecture Design (Gate VIG-01)
 *
 * In-memory dual-indexed graph storage with referential integrity enforcement,
 * idempotent duplicate detection, and deterministic Merkle root serialization.
 */

import {
  VIGNode,
  VIGEdge,
  SerializedVIGGraph,
  SerializeOptions,
  VIGValidationError,
  VIGConflictError,
  VIGIntegrityError,
} from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';
import { VIGModel } from './VIGModel';

export class VIGGraphStore {
  /** Primary Node Registry: CID -> VIGNode */
  private readonly nodes: Map<string, VIGNode> = new Map();

  /** Primary Edge Registry: EdgeID -> VIGEdge */
  private readonly edges: Map<string, VIGEdge> = new Map();

  /** Forward Adjacency: Source CID -> Outgoing Edges (Dependencies) */
  private readonly outgoing: Map<string, VIGEdge[]> = new Map();

  /** Reverse Adjacency: Target CID -> Incoming Edges (Dependents) */
  private readonly incoming: Map<string, VIGEdge[]> = new Map();

  /** Path Index: Normalized relative path -> Set of Member CIDs */
  private readonly pathToCids: Map<string, Set<string>> = new Map();

  public get nodeCount(): number {
    return this.nodes.size;
  }

  public get edgeCount(): number {
    return this.edges.size;
  }

  // ── Node Operations ─────────────────────────────────────────────────────────

  /**
   * Registers a VIGNode in the graph store.
   * - If node with CID does not exist: stores and indexes node.
   * - If node with CID exists and is structurally identical: returns existing node idempotently.
   * - If node with CID exists but attributes differ: throws VIGConflictError.
   */
  public addNode(node: VIGNode): VIGNode {
    if (!node || typeof node.cid !== 'string') {
      throw new VIGValidationError('Invalid node passed to addNode()');
    }

    const existing = this.nodes.get(node.cid);
    if (existing) {
      if (
        existing.kind === node.kind &&
        existing.path === node.path &&
        existing.name === node.name &&
        existing.contentHash === node.contentHash &&
        existing.isExported === node.isExported &&
        existing.spatialAddress === node.spatialAddress
      ) {
        return existing;
      }
      throw new VIGConflictError(
        `Node CID collision with conflicting attributes for CID "${node.cid}". Existing: [${existing.kind}:${existing.path}:${existing.name}], New: [${node.kind}:${node.path}:${node.name}]`
      );
    }

    this.nodes.set(node.cid, node);

    // Update path index
    let cids = this.pathToCids.get(node.path);
    if (!cids) {
      cids = new Set();
      this.pathToCids.set(node.path, cids);
    }
    cids.add(node.cid);

    return node;
  }

  public getNode(cid: string): VIGNode | undefined {
    return this.nodes.get(cid);
  }

  public hasNode(cid: string): boolean {
    return this.nodes.has(cid);
  }

  public getNodesByPath(path: string): readonly VIGNode[] {
    const normalized = VIGCanonicalizer.normalizePath(path);
    let cids = this.pathToCids.get(normalized);
    if ((!cids || cids.size === 0) && process.platform === 'win32') {
      const lower = normalized.toLowerCase();
      for (const [k, v] of this.pathToCids.entries()) {
        if (k.toLowerCase() === lower) {
          cids = v;
          break;
        }
      }
    }
    if (!cids || cids.size === 0) return [];
    const result: VIGNode[] = [];
    for (const cid of cids) {
      const node = this.nodes.get(cid);
      if (node) result.push(node);
    }
    return result;
  }

  public getAllNodes(): readonly VIGNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.cid.localeCompare(b.cid));
  }

  // ── Edge Operations ─────────────────────────────────────────────────────────

  /**
   * Adds a directed dependency edge to the graph store.
   * Enforces referential integrity: both sourceCid and targetCid must exist in nodes.
   * - If edge with edgeId exists and is identical: returns existing edge idempotently.
   * - If edge with edgeId exists but attributes differ: throws VIGConflictError.
   */
  public addEdge(edge: VIGEdge): VIGEdge {
    if (!edge || typeof edge.edgeId !== 'string') {
      throw new VIGValidationError('Invalid edge passed to addEdge()');
    }

    // 1. Strict Referential Integrity Check
    if (!this.nodes.has(edge.sourceCid)) {
      throw new VIGValidationError(
        `Referential integrity failure: Source node CID "${edge.sourceCid}" does not exist in graph store.`
      );
    }
    if (!this.nodes.has(edge.targetCid)) {
      throw new VIGValidationError(
        `Referential integrity failure: Target node CID "${edge.targetCid}" does not exist in graph store.`
      );
    }

    // 2. Duplicate / Collision Check
    const existing = this.edges.get(edge.edgeId);
    if (existing) {
      if (
        existing.sourceCid === edge.sourceCid &&
        existing.targetCid === edge.targetCid &&
        existing.relation === edge.relation &&
        existing.isPublicApi === edge.isPublicApi
      ) {
        return existing;
      }
      throw new VIGConflictError(
        `Edge collision with conflicting attributes for edgeId "${edge.edgeId}".`
      );
    }

    this.edges.set(edge.edgeId, edge);

    // 3. Update Forward Adjacency (outgoing from source)
    let outEdges = this.outgoing.get(edge.sourceCid);
    if (!outEdges) {
      outEdges = [];
      this.outgoing.set(edge.sourceCid, outEdges);
    }
    outEdges.push(edge);

    // 4. Update Reverse Adjacency (incoming to target)
    let inEdges = this.incoming.get(edge.targetCid);
    if (!inEdges) {
      inEdges = [];
      this.incoming.set(edge.targetCid, inEdges);
    }
    inEdges.push(edge);

    return edge;
  }

  public getEdge(edgeId: string): VIGEdge | undefined {
    return this.edges.get(edgeId);
  }

  public hasEdge(edgeId: string): boolean {
    return this.edges.has(edgeId);
  }

  public getOutgoingEdges(cid: string): readonly VIGEdge[] {
    const list = this.outgoing.get(cid);
    if (!list || list.length === 0) return [];
    return list.slice().sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  }

  public getIncomingEdges(cid: string): readonly VIGEdge[] {
    const list = this.incoming.get(cid);
    if (!list || list.length === 0) return [];
    return list.slice().sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  }

  /**
   * Returns all dependency nodes directly required by `cid` (targets of outgoing edges).
   * Sorted deterministically by CID.
   */
  public getDependencies(cid: string): readonly VIGNode[] {
    const outEdges = this.getOutgoingEdges(cid);
    const result: VIGNode[] = [];
    const seen = new Set<string>();
    for (const edge of outEdges) {
      if (!seen.has(edge.targetCid)) {
        seen.add(edge.targetCid);
        const node = this.nodes.get(edge.targetCid);
        if (node) result.push(node);
      }
    }
    return result.sort((a, b) => a.cid.localeCompare(b.cid));
  }

  /**
   * Returns all dependent nodes that directly require `cid` (sources of incoming edges).
   * Sorted deterministically by CID.
   */
  public getDependents(cid: string): readonly VIGNode[] {
    const inEdges = this.getIncomingEdges(cid);
    const result: VIGNode[] = [];
    const seen = new Set<string>();
    for (const edge of inEdges) {
      if (!seen.has(edge.sourceCid)) {
        seen.add(edge.sourceCid);
        const node = this.nodes.get(edge.sourceCid);
        if (node) result.push(node);
      }
    }
    return result.sort((a, b) => a.cid.localeCompare(b.cid));
  }

  /**
   * Removes an edge by edgeId. Updates outgoing and incoming adjacency indexes atomically.
   */
  public removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    this.edges.delete(edgeId);

    // Remove from outgoing
    const outList = this.outgoing.get(edge.sourceCid);
    if (outList) {
      const idx = outList.findIndex((e) => e.edgeId === edgeId);
      if (idx !== -1) outList.splice(idx, 1);
      if (outList.length === 0) this.outgoing.delete(edge.sourceCid);
    }

    // Remove from incoming
    const inList = this.incoming.get(edge.targetCid);
    if (inList) {
      const idx = inList.findIndex((e) => e.edgeId === edgeId);
      if (idx !== -1) inList.splice(idx, 1);
      if (inList.length === 0) this.incoming.delete(edge.targetCid);
    }

    return true;
  }

  /**
   * Removes a node by CID. Cascades removal to all incoming and outgoing edges.
   */
  public removeNode(cid: string): boolean {
    const node = this.nodes.get(cid);
    if (!node) return false;

    // Remove all outgoing edges
    const outEdges = (this.outgoing.get(cid) ?? []).slice();
    for (const edge of outEdges) {
      this.removeEdge(edge.edgeId);
    }

    // Remove all incoming edges
    const inEdges = (this.incoming.get(cid) ?? []).slice();
    for (const edge of inEdges) {
      this.removeEdge(edge.edgeId);
    }

    // Remove from pathToCids
    const pathSet = this.pathToCids.get(node.path);
    if (pathSet) {
      pathSet.delete(cid);
      if (pathSet.size === 0) this.pathToCids.delete(node.path);
    }

    this.nodes.delete(cid);
    return true;
  }

  public getAllEdges(): readonly VIGEdge[] {
    return Array.from(this.edges.values()).sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  }

  // ── Reset ───────────────────────────────────────────────────────────────────

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoing.clear();
    this.incoming.clear();
    this.pathToCids.clear();
  }

  // ── Deterministic Serialization & Deserialization ───────────────────────────

  /**
   * Computes the cryptographic Merkle root seal across all sorted nodes and edges.
   */
  public computeRootSeal(): string {
    const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.cid.localeCompare(b.cid));
    const sortedEdges = Array.from(this.edges.values()).sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    return VIGCanonicalizer.computeGraphSeal(sortedNodes, sortedEdges);
  }

  /**
   * Serializes the graph store to a deterministic, sorted, content-sealed record.
   * Runtime metadata (such as serializedAt) is excluded by default to ensure
   * bit-identical determinism for equivalent graph states. Callers requiring
   * operational timestamps can pass options.
   */
  public serialize(options?: SerializeOptions): SerializedVIGGraph {
    const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.cid.localeCompare(b.cid));
    const sortedEdges = Array.from(this.edges.values()).sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    const graphRootSeal = VIGCanonicalizer.computeGraphSeal(sortedNodes, sortedEdges);

    const record: SerializedVIGGraph = {
      schemaVersion: 1,
      graphRootSeal,
      nodeCount: sortedNodes.length,
      edgeCount: sortedEdges.length,
      nodes: sortedNodes,
      edges: sortedEdges,
      ...(options?.serializedAt !== undefined
        ? { serializedAt: options.serializedAt }
        : options?.includeTimestamp
        ? { serializedAt: Date.now() }
        : {}),
    };

    return VIGCanonicalizer.sortKeysRecursively(record) as SerializedVIGGraph;
  }

  public serializeToString(pretty: boolean = false, options?: SerializeOptions): string {
    const data = this.serialize(options);
    return VIGCanonicalizer.canonicalizeJson(data, pretty);
  }

  /**
   * Serializes the graph store to a canonical, deterministic JSON string
   * with lexicographically sorted property ordering and stable hash representation.
   */
  public serializeCanonical(pretty: boolean = false): string {
    return this.serializeToString(pretty);
  }

  /**
   * Computes SHA-256 hash of the canonical serialized graph.
   */
  public computeCanonicalHash(): string {
    return VIGCanonicalizer.computeCanonicalHash(this.serializeCanonical());
  }

  /**
   * Reconstitutes a VIGGraphStore from a serialized record or JSON string.
   * Validates schemaVersion and verifies cryptographic Merkle root seal.
   */
  public static deserialize(serialized: SerializedVIGGraph | string): VIGGraphStore {
    let payload: SerializedVIGGraph;
    if (typeof serialized === 'string') {
      try {
        payload = JSON.parse(serialized) as SerializedVIGGraph;
      } catch (err: any) {
        throw new VIGIntegrityError(`Failed to parse serialized graph JSON: ${err.message}`);
      }
    } else {
      payload = serialized;
    }

    if (!payload || payload.schemaVersion !== 1) {
      throw new VIGIntegrityError(
        `Unsupported graph schema version: ${payload?.schemaVersion} (expected 1)`
      );
    }

    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
      throw new VIGIntegrityError('Serialized graph is missing valid nodes or edges arrays');
    }

    // Cryptographic Merkle Root Seal Verification
    const expectedSeal = VIGCanonicalizer.computeGraphSeal(payload.nodes, payload.edges);
    if (payload.graphRootSeal !== expectedSeal) {
      throw new VIGIntegrityError(
        `Cryptographic graph root seal mismatch! Expected: "${expectedSeal}", got: "${payload.graphRootSeal}". Payload may be tampered or corrupted.`
      );
    }

    const store = new VIGGraphStore();

    try {
      // 1. Re-insert all nodes first (with full validation)
      for (const rawNode of payload.nodes) {
        const validatedNode = VIGModel.createNode({
          cid: rawNode.cid,
          kind: rawNode.kind,
          path: rawNode.path,
          name: rawNode.name,
          contentHash: rawNode.contentHash,
          version: rawNode.version,
          location: rawNode.location,
          isExported: rawNode.isExported,
          spatialAddress: rawNode.spatialAddress,
          metadata: rawNode.metadata as Record<string, unknown>,
          indexedAt: rawNode.indexedAt,
        });
        store.addNode(validatedNode);
      }

      // 2. Re-insert all edges second (which validates referential integrity)
      for (const rawEdge of payload.edges) {
        const validatedEdge = VIGModel.createEdge({
          edgeId: rawEdge.edgeId,
          sourceCid: rawEdge.sourceCid,
          targetCid: rawEdge.targetCid,
          relation: rawEdge.relation,
          isPublicApi: rawEdge.isPublicApi,
          metadata: rawEdge.metadata as Record<string, unknown>,
        });
        store.addEdge(validatedEdge);
      }
    } catch (err: any) {
      if (err instanceof VIGValidationError || err instanceof VIGConflictError) {
        throw new VIGIntegrityError(
          `Serialized graph contains corrupted or invalid entities: ${err.message}`
        );
      }
      throw err;
    }

    return store;
  }
}
