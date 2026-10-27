/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGInvalidator
 * Specification: VIG Phase 4 Change Detection & Selective Invalidation
 *
 * Implements selective node/edge invalidation, fine-grained AST re-indexing,
 * cascade propagation for public API breaks, and no-op zero-rebuild execution.
 */

import {
  VIGNode,
  VIGManifest,
  VIGFileManifestEntry,
  ChangeDetectionResult,
  SelectiveInvalidationResult,
} from './types';
import { VIGGraphStore } from './VIGGraphStore';
import { VIGImpactTracker } from './VIGImpactTracker';
import { VIGASTExtractor } from './VIGASTExtractor';
import { VIGManifestManager } from './VIGManifestManager';

export class VIGInvalidator {
  /**
   * Executes selective invalidation and incremental re-indexing against a VIGGraphStore.
   *
   * @param scanResult Result from VIGChangeScanner.
   * @param store The active in-memory VIGGraphStore.
   * @param fileContents Function or Map providing source text for re-indexed files.
   * @param currentManifest Active manifest before changes.
   */
  public static invalidateAndReindex(
    scanResult: ChangeDetectionResult,
    store: VIGGraphStore,
    fileContents: (filePath: string) => string | undefined,
    currentManifest: VIGManifest | null
  ): {
    result: SelectiveInvalidationResult;
    updatedManifest: VIGManifest;
  } {
    const startMs = performance.now();

    // 1. Genuine No-Op Fast Path
    if (scanResult.isNoOp) {
      const durationMs = performance.now() - startMs;
      return {
        result: {
          isNoOp: true,
          invalidatedCids: [],
          reindexedFiles: [],
          removedCids: [],
          affectedDownstreamNodes: [],
          requiredTestSuites: [],
          isPublicApiBreached: false,
          manifestUpdated: false,
          durationMs,
        },
        updatedManifest: currentManifest ?? VIGManifestManager.createManifest({}),
      };
    }

    const invalidatedCids: string[] = [];
    const removedCids: string[] = [];
    const reindexedFiles: string[] = [];
    const affectedDownstreamMap = new Map<string, VIGNode>();
    const requiredTestMap = new Map<string, VIGNode>();
    let isPublicApiBreached = false;

    // Working copy of manifest entries
    const updatedFileMap: Record<string, VIGFileManifestEntry> = {
      ...(currentManifest?.files ?? {}),
    };

    // 2. Process Deletions
    for (const delPath of scanResult.deletedFiles) {
      delete updatedFileMap[delPath];
      const existingNodes = store.getNodesByPath(delPath);
      for (const node of existingNodes) {
        removedCids.push(node.cid);
        invalidatedCids.push(node.cid);
        store.removeNode(node.cid);
      }
    }

    // 3. Pass 1: Invalidate old nodes and extract/insert new nodes
    const filesToExtract: { filePath: string; content: string; change: any }[] = [];
    const knownFiles = new Set<string>(Object.keys(updatedFileMap));
    for (const change of scanResult.changedFiles) {
      if (change.classification === 'FILE_DELETED') continue;
      knownFiles.add(change.path);
    }

    const nodeResolver = (targetPath: string): VIGNode | undefined => {
      const candidates = store.getNodesByPath(targetPath);
      return candidates.find((n) => n.kind === 'SOURCE_FILE' || n.kind === 'TEST_SUITE') ?? candidates[0];
    };

    const extractions = new Map<string, any>();
    for (const change of scanResult.changedFiles) {
      const filePath = change.path;
      if (change.classification === 'FILE_DELETED') continue;

      const oldNodes = store.getNodesByPath(filePath);
      for (const oldNode of oldNodes) {
        invalidatedCids.push(oldNode.cid);
        store.removeNode(oldNode.cid);
      }

      const content = fileContents(filePath);
      if (content !== undefined) {
        filesToExtract.push({ filePath, content, change });
        const extraction = VIGASTExtractor.extractFromSource(filePath, content, { knownFiles });
        for (const node of extraction.nodes) {
          store.addNode(node);
        }
        extractions.set(filePath, extraction);
        reindexedFiles.push(filePath);

        if (change.newEntry) {
          updatedFileMap[filePath] = change.newEntry;
        }
      }
    }

    // Pass 2: Extract & link cross-file edges now that all nodes are present in store
    for (const { filePath, content } of filesToExtract) {
      const extractionWithEdges = VIGASTExtractor.extractFromSource(filePath, content, {
        knownFiles,
        nodeResolver,
      });
      for (const edge of extractionWithEdges.edges) {
        try {
          store.addEdge(edge);
        } catch {
          // Ignore duplicate / unresolvable
        }
      }
      extractions.set(filePath, extractionWithEdges);
    }

    // Re-link existing consumers in store that import any of the changed files
    for (const changedPath of reindexedFiles) {
      for (const existingPath of Object.keys(updatedFileMap)) {
        if (!reindexedFiles.includes(existingPath)) {
          const existingContent = fileContents(existingPath);
          if (existingContent) {
            const relinked = VIGASTExtractor.extractFromSource(existingPath, existingContent, {
              knownFiles,
              nodeResolver,
            });
            for (const edge of relinked.edges) {
              if (edge.relation === 'IMPORTS' || edge.relation === 'TESTS_MODULE') {
                try {
                  store.addEdge(edge);
                } catch {}
              }
            }
          }
        }
      }
    }

    // 4. Cascade Invalidation based on Classification
    for (const { filePath, change } of filesToExtract) {
      const extraction = extractions.get(filePath);
      if (!extraction) continue;

      if (change.classification === 'PUBLIC_API_SIGNATURE_CHANGE' || change.classification === 'FILE_ADDED') {
        isPublicApiBreached = true;
        const rootCids = extraction.nodes
          .filter((n: any) => n.isExported || n.kind === 'SOURCE_FILE')
          .map((n: any) => n.cid);

        const impact = VIGImpactTracker.computeDownstreamImpact(rootCids, store);
        for (const affected of impact.affectedNodes) {
          affectedDownstreamMap.set(affected.cid, affected);
        }
        for (const test of impact.requiredTestSuites) {
          requiredTestMap.set(test.cid, test);
        }
      } else if (change.classification === 'PRIVATE_IMPLEMENTATION_CHANGE') {
        const fileNode = extraction.nodes.find(
          (n: any) => n.kind === 'SOURCE_FILE' || n.kind === 'TEST_SUITE'
        );
        if (fileNode) {
          const incomingEdges = store.getIncomingEdges(fileNode.cid);
          for (const edge of incomingEdges) {
            if (edge.relation === 'TESTS_MODULE') {
              const testNode = store.getNode(edge.sourceCid);
              if (testNode) {
                requiredTestMap.set(testNode.cid, testNode);
              }
            }
          }
        }
      }
    }

    // Generate updated Merkle-sealed manifest
    const updatedManifest = VIGManifestManager.createManifest(updatedFileMap);
    const durationMs = performance.now() - startMs;

    return {
      result: {
        isNoOp: false,
        invalidatedCids: Array.from(new Set(invalidatedCids)).sort(),
        reindexedFiles: reindexedFiles.sort(),
        removedCids: Array.from(new Set(removedCids)).sort(),
        affectedDownstreamNodes: Array.from(affectedDownstreamMap.values()).sort((a, b) =>
          a.cid.localeCompare(b.cid)
        ),
        requiredTestSuites: Array.from(requiredTestMap.values()).sort((a, b) =>
          a.cid.localeCompare(b.cid)
        ),
        isPublicApiBreached,
        manifestUpdated: true,
        durationMs,
      },
      updatedManifest,
    };
  }
}
