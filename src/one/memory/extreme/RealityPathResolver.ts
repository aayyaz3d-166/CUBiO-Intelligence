/**
 * ONE Language — Reality / Path / State Resolver
 * ===============================================
 * Module: @one/memory/extreme/RealityPathResolver
 *
 * Implements Section 11 of Extreme-Scale 3D Memory Toolchain.
 * Formally enforces the CUBiO research invariant:
 *
 *              PATH ≠ STATE ≠ REALITY
 *
 * Ensures that two identical states achieved through different causal histories
 * generate distinct, sovereign reality/path identities without identity collapse.
 */

import * as crypto from 'crypto';
import { StateNode } from '../../reality/StateNode';
import { StateTransition } from '../../reality/Transition';
import { CanonicalReality } from '../../reality/CanonicalReality';

export interface CausalPathTrace {
  readonly pathId: string;
  readonly branchId: string;
  readonly transitionIds: string[];
  readonly depth: number;
  readonly pathDigestSha256: string;
}

export interface ResolvedRealityIdentity {
  readonly realityId: string;
  readonly branchId: string;
  readonly stateId: string;
  readonly pathId: string;
  readonly stateHashSha256: string;
  readonly pathDigestSha256: string;
  readonly compositeIdentityHash: string;
  readonly depth: number;
  readonly timestampMs: number;
}

export class RealityIdentityCollapseError extends Error {
  constructor(message: string) {
    super(`[RealityPathResolver Invariant Error] ${message}`);
    this.name = 'RealityIdentityCollapseError';
  }
}

export class RealityPathResolver {
  /**
   * Derives an immutable CausalPathTrace from a sequence of state transitions.
   */
  public static derivePathTrace(branchId: string, transitions: StateTransition[]): CausalPathTrace {
    const tIds = transitions.map(t => t.transitionId);
    const hasher = crypto.createHash('sha256');
    hasher.update(`BRANCH:${branchId}`);
    for (const tid of tIds) {
      hasher.update(`->${tid}`);
    }
    const digest = hasher.digest('hex');

    return {
      pathId: `path_${branchId}_${digest.substring(0, 16)}`,
      branchId,
      transitionIds: tIds,
      depth: transitions.length,
      pathDigestSha256: digest,
    };
  }

  /**
   * Resolves composite identity enforcing PATH ≠ STATE ≠ REALITY.
   * Two identical states with different causal paths will yield DIFFERENT composite identities.
   */
  public static resolveIdentity(
    realityId: string,
    branchId: string,
    state: StateNode,
    pathTrace: CausalPathTrace
  ): ResolvedRealityIdentity {
    const statePayloadHash = state.stateHash;
    const pathDigest = pathTrace.pathDigestSha256;

    // Composite hash: SHA-256(realityId + branchId + stateHash + pathDigest)
    const compositeHasher = crypto.createHash('sha256');
    compositeHasher.update(`REALITY:${realityId}`);
    compositeHasher.update(`|BRANCH:${branchId}`);
    compositeHasher.update(`|STATE:${statePayloadHash}`);
    compositeHasher.update(`|PATH:${pathDigest}`);
    const compositeHash = compositeHasher.digest('hex');

    return {
      realityId,
      branchId,
      stateId: state.stateId,
      pathId: pathTrace.pathId,
      stateHashSha256: statePayloadHash,
      pathDigestSha256: pathDigest,
      compositeIdentityHash: `0xREALITY_${compositeHash.substring(0, 32)}`,
      depth: pathTrace.depth,
      timestampMs: state.createdAtTick,
    };
  }

  /**
   * Verifies that two reality states preserve the PATH ≠ STATE ≠ REALITY invariant.
   * If states have identical payloads but different paths, their composite identities MUST NOT match.
   */
  public static verifyPathStateDisjointness(
    idA: ResolvedRealityIdentity,
    idB: ResolvedRealityIdentity
  ): { invariantPreserved: boolean; reason: string } {
    const sameState = idA.stateHashSha256 === idB.stateHashSha256;
    const samePath = idA.pathDigestSha256 === idB.pathDigestSha256;
    const sameIdentity = idA.compositeIdentityHash === idB.compositeIdentityHash;

    if (sameState && !samePath && sameIdentity) {
      throw new RealityIdentityCollapseError(
        `Critical identity collapse: Same state reached via different paths collapsed into identical reality identity '${idA.compositeIdentityHash}'.`
      );
    }

    if (sameState && !samePath) {
      return {
        invariantPreserved: true,
        reason: 'Identical state correctly differentiated by divergent causal paths (PATH != STATE != REALITY certified).',
      };
    }

    return {
      invariantPreserved: true,
      reason: 'States and paths are uniquely disambiguated.',
    };
  }
}
