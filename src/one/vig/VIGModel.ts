/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGModel
 * Specification: VIG Phase 1 Minimal Architecture Design (Gate VIG-01)
 *
 * Immutable, schema-validated node and edge factory models
 * with fail-closed integrity checks.
 */

import {
  VIGNode,
  VIGEdge,
  VIGNodeKind,
  VIGRelationType,
  VIGSourceLocation,
  VIGValidationError,
} from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';

export const VALID_NODE_KINDS: ReadonlySet<string> = new Set([
  'SOURCE_FILE',
  'MODULE',
  'AST_DECLARATION',
  'TEST_SUITE',
  'COMMIT_ANCHOR',
  'VERIFICATION_RUN',
  'SPATIAL_ANCHOR',
]);

export const VALID_RELATION_TYPES: ReadonlySet<string> = new Set([
  'IMPORTS',
  'CALLS',
  'EXTENDS_OR_IMPLEMENTS',
  'DEFINES_SYMBOL',
  'TESTS_MODULE',
  'DERIVED_FROM_COMMIT',
  'MAPS_TO_SPATIAL_CELL',
]);

export interface CreateNodeParams {
  cid?: string;
  kind: VIGNodeKind;
  path: string;
  name: string;
  contentHash: string;
  version?: number;
  location?: VIGSourceLocation;
  isExported?: boolean;
  spatialAddress?: number;
  metadata?: Record<string, unknown>;
  indexedAt?: number;
  repoRoot?: string;
}

export interface CreateEdgeParams {
  edgeId?: string;
  sourceCid: string;
  targetCid: string;
  relation: VIGRelationType;
  isPublicApi?: boolean;
  metadata?: Record<string, unknown>;
}

export class VIGModel {
  /**
   * Constructs an immutable, validated VIGNode instance.
   * Throws VIGValidationError on any malformed or out-of-bounds input.
   */
  public static createNode(params: CreateNodeParams): VIGNode {
    if (!params) {
      throw new VIGValidationError('Cannot create node from null or undefined parameters');
    }

    // 1. Kind Validation
    if (!params.kind || !VALID_NODE_KINDS.has(params.kind)) {
      throw new VIGValidationError(`Invalid or unsupported node kind: "${String(params.kind)}"`);
    }

    // 2. Name Validation
    if (typeof params.name !== 'string' || params.name.trim().length === 0) {
      throw new VIGValidationError(`Node name must be a non-empty string, got: "${String(params.name)}"`);
    }
    const normalizedName = params.name.trim();

    // 3. Path Normalization & Validation
    if (typeof params.path !== 'string') {
      throw new VIGValidationError(`Node path must be a string, got: ${typeof params.path}`);
    }
    const normalizedPath = VIGCanonicalizer.normalizePath(params.path, params.repoRoot);
    if (normalizedPath.length === 0 && params.kind !== 'COMMIT_ANCHOR') {
      throw new VIGValidationError('Node path must not be empty');
    }

    // 4. Content Hash Validation
    if (!VIGCanonicalizer.isValidCID(params.contentHash)) {
      throw new VIGValidationError(
        `contentHash must be a 64-character lowercase hexadecimal string, got: "${String(params.contentHash)}"`
      );
    }

    // 5. Spatial Address Validation (Bounds [0..368])
    if (params.spatialAddress !== undefined) {
      if (!VIGCanonicalizer.isValidSpatialAddress(params.spatialAddress)) {
        throw new VIGValidationError(
          `spatialAddress ${params.spatialAddress} is outside valid CanonicalAddress369 range [0..368]`
        );
      }
    }

    // 6. CID Computation & Verification
    const expectedCid = VIGCanonicalizer.computeNodeCID(
      params.kind,
      normalizedPath,
      normalizedName,
      params.contentHash
    );

    if (params.cid !== undefined && params.cid !== expectedCid) {
      throw new VIGValidationError(
        `Supplied CID "${params.cid}" does not match computed deterministic CID "${expectedCid}"`
      );
    }

    // 7. Location Validation
    if (params.location) {
      const loc = params.location;
      if (
        loc.startLine < 1 ||
        loc.startColumn < 0 ||
        loc.endLine < loc.startLine ||
        (loc.endLine === loc.startLine && loc.endColumn < loc.startColumn)
      ) {
        throw new VIGValidationError(`Invalid source location coordinates: ${JSON.stringify(loc)}`);
      }
    }

    const metadataCopy = params.metadata ? { ...params.metadata } : {};
    Object.freeze(metadataCopy);

    const node: VIGNode = Object.freeze({
      cid: expectedCid,
      kind: params.kind,
      path: normalizedPath,
      name: normalizedName,
      contentHash: params.contentHash,
      version: params.version ?? 1,
      location: params.location ? Object.freeze({ ...params.location }) : undefined,
      isExported: params.isExported ?? false,
      spatialAddress: params.spatialAddress,
      metadata: metadataCopy,
      indexedAt: params.indexedAt ?? Date.now(),
    });

    return node;
  }

  /**
   * Constructs an immutable, validated VIGEdge instance.
   * Throws VIGValidationError on any malformed input.
   */
  public static createEdge(params: CreateEdgeParams): VIGEdge {
    if (!params) {
      throw new VIGValidationError('Cannot create edge from null or undefined parameters');
    }

    // 1. CID Validations
    if (!VIGCanonicalizer.isValidCID(params.sourceCid)) {
      throw new VIGValidationError(
        `sourceCid must be a 64-character lowercase hex string, got: "${String(params.sourceCid)}"`
      );
    }
    if (!VIGCanonicalizer.isValidCID(params.targetCid)) {
      throw new VIGValidationError(
        `targetCid must be a 64-character lowercase hex string, got: "${String(params.targetCid)}"`
      );
    }

    // 2. Relation Validation
    if (!params.relation || !VALID_RELATION_TYPES.has(params.relation)) {
      throw new VIGValidationError(`Invalid or unsupported edge relation: "${String(params.relation)}"`);
    }

    // 3. Edge ID Computation & Verification
    const expectedEdgeId = VIGCanonicalizer.computeEdgeId(
      params.sourceCid,
      params.relation,
      params.targetCid
    );

    if (params.edgeId !== undefined && params.edgeId !== expectedEdgeId) {
      throw new VIGValidationError(
        `Supplied edgeId "${params.edgeId}" does not match computed deterministic edgeId "${expectedEdgeId}"`
      );
    }

    const metadataCopy = params.metadata ? { ...params.metadata } : undefined;
    if (metadataCopy) Object.freeze(metadataCopy);

    const edge: VIGEdge = Object.freeze({
      edgeId: expectedEdgeId,
      sourceCid: params.sourceCid,
      targetCid: params.targetCid,
      relation: params.relation,
      isPublicApi: params.isPublicApi ?? false,
      metadata: metadataCopy,
    });

    return edge;
  }
}
