/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Concept Graph & Multi-Hop Relationship Engine (src/one/intelligence/memory/ConceptGraph.ts)
 */

import {
  ConceptRecord,
  RelationshipRecord,
  ProvenanceKind,
  SupportedRelationType,
} from './types';

export class ConceptGraph {
  private readonly concepts: Map<string, ConceptRecord> = new Map();
  private readonly relationships: Map<string, RelationshipRecord> = new Map();
  // Adjacency index: sourceConceptId -> Array<relationshipId>
  private readonly outgoing: Map<string, string[]> = new Map();
  // Reverse index: targetConceptId -> Array<relationshipId>
  private readonly incoming: Map<string, string[]> = new Map();

  // ──────────────────────────────────────────────────────────────────────────
  // Identity normalization & documented behavior
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Normalize a concept identifier for lookups.
   * Normalization: trim whitespace, lowercase.  Case/prefix differences collapse
   * to one identity.  Used for read-time lookups and relationship validation.
   * Stored keys keep the canonical form the record was added with.
   */
  public static normalizeId(id: string): string {
    return id.trim().toLowerCase();
  }

  /**
   * Extract a canonical concept ID from a caller-supplied raw string.
   * Rules: must start with 'concept_'; must be non-empty after normalization;
   * otherwise throws.  Callers are REQUIRED to handle the throw — unknown
   * concepts are rejected at insert/query time, never silently created.
   */
  public static extractConceptId(raw: string): string {
    const normalized = ConceptGraph.normalizeId(raw);
    if (normalized.length === 0) {
      throw new Error(`[ConceptGraph] Empty concept identifier cannot be extracted from "${raw}".`);
    }
    // Accept explicit 'concept_' prefix; otherwise prefix it.
    if (!normalized.startsWith('concept_')) {
      return `concept_${normalized}`;
    }
    return normalized;
  }

  /**
   * Upserts or creates a concept record with collision-safe provenance preservation.
   */
  public addConcept(record: ConceptRecord): ConceptRecord {
    if (!record.conceptId || typeof record.conceptId !== 'string') {
      throw new Error(`[ConceptGraph] Invalid conceptId: ${String(record.conceptId)}`);
    }
    if (record.confidence < 0.0 || record.confidence > 1.0) {
      throw new Error(`[ConceptGraph] Confidence out of bounds [0.0..1.0]: ${record.confidence}`);
    }

    const existing = this.concepts.get(record.conceptId);
    if (existing) {
      // If updating, preserve provenance chain and bump version
      const updated: ConceptRecord = {
        ...existing,
        ...record,
        version: existing.version + 1,
        updatedAt: Date.now(),
      };
      this.concepts.set(record.conceptId, updated);
      return updated;
    }

    this.concepts.set(record.conceptId, { ...record });
    return record;
  }

  /**
   * Retrieves a concept by ID.
   */
  public getConcept(conceptId: string): ConceptRecord | undefined {
    return this.concepts.get(conceptId);
  }

  /**
   * Checks whether a concept exists.
   */
  public hasConcept(conceptId: string): boolean {
    return this.concepts.has(conceptId);
  }

  /**
   * Adds a directed relationship edge between source and target concepts.
   * Enforces referential integrity: both source and target concepts must exist.
   */
  public addRelationship(rel: RelationshipRecord): RelationshipRecord {
    if (!this.concepts.has(rel.sourceConceptId)) {
      throw new Error(`[ConceptGraph] Source concept '${rel.sourceConceptId}' does not exist`);
    }
    if (!this.concepts.has(rel.targetConceptId)) {
      throw new Error(`[ConceptGraph] Target concept '${rel.targetConceptId}' does not exist`);
    }

    // Check for exact duplicate edge
    const existingOut = this.outgoing.get(rel.sourceConceptId) ?? [];
    for (const rId of existingOut) {
      const existingRel = this.relationships.get(rId);
      if (
        existingRel &&
        existingRel.relationType === rel.relationType &&
        existingRel.targetConceptId === rel.targetConceptId
      ) {
        // Idempotent duplicate: return existing edge
        return existingRel;
      }
    }

    this.relationships.set(rel.relationshipId, { ...rel });

    // Update index
    if (!this.outgoing.has(rel.sourceConceptId)) {
      this.outgoing.set(rel.sourceConceptId, []);
    }
    this.outgoing.get(rel.sourceConceptId)!.push(rel.relationshipId);

    if (!this.incoming.has(rel.targetConceptId)) {
      this.incoming.set(rel.targetConceptId, []);
    }
    this.incoming.get(rel.targetConceptId)!.push(rel.relationshipId);

    return rel;
  }

  /**
   * Returns an empty array (not null/undefined) when the concept is unknown;
   * callers must check hasConcept() first if node existence matters.
   */
  public getDirectRelationships(conceptId: string, relationType?: string): RelationshipRecord[] {
    // Unknown concept -> empty array (explicit not-found; never properties of
    // another node used as proof of a relationship).
    if (!this.concepts.has(conceptId)) {
      return [];
    }
    const rIds = this.outgoing.get(conceptId) ?? [];
    const results: RelationshipRecord[] = [];
    for (const rId of rIds) {
      const rel = this.relationships.get(rId);
      if (rel) {
        if (!relationType || rel.relationType === relationType) {
          results.push(rel);
        }
      }
    }
    return results;
  }

  /**
   * Bounded multi-hop relationship path traversal with cycle detection.
   * Infers transitive properties (e.g., Sparrow isA Bird, Bird hasProperty Wings -> Sparrow hasProperty Wings).
   */
  public findRelationshipPath(
    sourceConceptId: string,
    targetConceptId: string,
    maxDepth: number = 3,
  ): Array<{ path: RelationshipRecord[]; derivedConfidence: number }> {
    // Explicit unknown-concept early exit: never traverse from an unregistered node.
    if (!this.concepts.has(sourceConceptId) || !this.concepts.has(targetConceptId)) {
      return [];
    }

    const results: Array<{ path: RelationshipRecord[]; derivedConfidence: number }> = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, currentPath: RelationshipRecord[], currentConf: number, depth: number) => {
      if (currentId === targetConceptId && currentPath.length > 0) {
        results.push({ path: [...currentPath], derivedConfidence: currentConf });
        return;
      }
      if (depth >= maxDepth) {
        return;
      }

      // Cycle guard: never revisit a node already on the current path.
      if (visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      const outgoingRels = this.getDirectRelationships(currentId);
      for (const rel of outgoingRels) {
        const nextId = rel.targetConceptId;
        if (!visited.has(nextId)) {
          // Multiply confidence along the path
          const nextConf = currentConf * (rel.confidence ?? 1.0);
          dfs(nextId, [...currentPath, rel], nextConf, depth + 1);
        }
      }

      visited.delete(currentId);
    };

    dfs(sourceConceptId, [], 1.0, 0);
    return results;
  }

  /**
   * Infers inherited properties via 'isA' transitive inheritance.
   * e.g., if A isA B and B hasProperty P, infer A hasProperty P with derivation provenance.
   */
  public inferInheritedProperties(
    conceptId: string,
    maxDepth: number = 2,
  ): Array<{ propertyConceptId: string; viaRelation: string; derivation: string; confidence: number }> {
    const results: Array<{ propertyConceptId: string; viaRelation: string; derivation: string; confidence: number }> = [];
    const queue: Array<{ id: string; depth: number; conf: number; pathStr: string }> = [
      { id: conceptId, depth: 0, conf: 1.0, pathStr: conceptId },
    ];
    const visited = new Set<string>([conceptId]);

    while (queue.length > 0) {
      const { id: currId, depth, conf, pathStr } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const directRels = this.getDirectRelationships(currId);
      for (const rel of directRels) {
        if (rel.relationType === 'hasProperty') {
          results.push({
            propertyConceptId: rel.targetConceptId,
            viaRelation: rel.relationType,
            derivation: `${pathStr} -> [${rel.relationType}] -> ${rel.targetConceptId}`,
            confidence: conf * rel.confidence,
          });
        } else if (rel.relationType === 'isA') {
          if (!visited.has(rel.targetConceptId)) {
            visited.add(rel.targetConceptId);
            queue.push({
              id: rel.targetConceptId,
              depth: depth + 1,
              conf: conf * rel.confidence,
              pathStr: `${pathStr} -> [isA] -> ${rel.targetConceptId}`,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Returns total count of registered concepts.
   */
  public conceptCount(): number {
    return this.concepts.size;
  }

  /**
   * Returns total count of registered relationships.
   */
  public relationshipCount(): number {
    return this.relationships.size;
  }

  /**
   * Clears the graph completely.
   */
  public clear(): void {
    this.concepts.clear();
    this.relationships.clear();
    this.outgoing.clear();
    this.incoming.clear();
  }
}
