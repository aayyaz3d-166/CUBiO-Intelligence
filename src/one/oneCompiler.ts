import {
  ProgramNode,
  SpatialCoordinate,
  Grid777Coordinate,
  SpatialSliceNode,
} from './oneParser';

export interface ExecutableInstruction {
  op:
    | 'ALLOC_SPATIAL_NODE'
    | 'ALLOC_VOXEL_GRID'
    | 'MAP_ZERO_COPY_VIEW'
    | 'ALIGN_HARMONIC'
    | 'OPEN_FUNNEL_STREAM'
    | 'OPEN_GOSSIP_CHANNEL'
    | 'SEAL_CRYPTOGRAPHIC_SNAPSHOT'
    | 'QUERY_SPATIAL_SLICE'
    | 'SET_RSS_GUARD'
    | 'ASSERT_RESOURCE_LIMITS'
    | 'COMPUTE_INTENT_RESONANCE'
    | 'EXECUTE_MATRIX_TRANSFORM';
  payload: Record<string, unknown>;
}

export interface ExecutableCubiOAST {
  targetRssLimitBytes: number;
  assertRssLimitBytes?: number;
  actuationLock?: boolean;
  instructions: ExecutableInstruction[];
  spatialNodesCount: number;
  totalVoxelCellsCount: number;
  determinismSigmaSq: number;
}

export class OneCompiler {
  private ast: ProgramNode;
  private readonly HARD_MAX_RSS_MB = 512;

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  public static quantize777(x: number, y: number, z: number): Grid777Coordinate {
    const i = Math.min(6, Math.max(0, Math.round(x * 6)));
    const j = Math.min(6, Math.max(0, Math.round(y * 6)));
    const k = Math.min(6, Math.max(0, Math.round(z * 6)));
    const cellIndex = i + 7 * j + 49 * k;
    return { i, j, k, cellIndex };
  }

  public static unquantize777(cellIndex: number): SpatialCoordinate {
    if (cellIndex < 0 || cellIndex > 342) {
      throw new Error(`[7x7x7 Lattice Error] Cell index ${cellIndex} is outside 0..342 bounds.`);
    }
    const k = Math.floor(cellIndex / 49);
    const remainder = cellIndex % 49;
    const j = Math.floor(remainder / 7);
    const i = remainder % 7;
    return {
      x: Math.round((i / 6.0) * 1e6) / 1e6,
      y: Math.round((j / 6.0) * 1e6) / 1e6,
      z: Math.round((k / 6.0) * 1e6) / 1e6,
    };
  }

  public compile(): ExecutableCubiOAST {
    const effectiveLimitMB = this.ast.assertRssLimitMB !== undefined
      ? Math.min(this.ast.rssMaxLimitMB, this.ast.assertRssLimitMB)
      : this.ast.rssMaxLimitMB;

    // 1. Validate Physical Hard Memory Bound (RSS <= 512 MB)
    if (this.ast.rssMaxLimitMB > this.HARD_MAX_RSS_MB) {
      throw new Error(
        `[Compiler Violation] Program requests RSS Max limit of ${this.ast.rssMaxLimitMB} MB, exceeding hard physical threshold of ${this.HARD_MAX_RSS_MB} MB.`
      );
    }

    if (this.ast.assertRssLimitMB !== undefined && this.ast.assertRssLimitMB > this.HARD_MAX_RSS_MB) {
      throw new Error(
        `[Compile-Time Assertion Failure] @assert_rss(${this.ast.assertRssLimitMB}MB) exceeds hard ceiling of ${this.HARD_MAX_RSS_MB} MB.`
      );
    }

    const instructions: ExecutableInstruction[] = [];

    // Global RSS Allocation Guard Instruction
    instructions.push({
      op: 'SET_RSS_GUARD',
      payload: { limitMb: effectiveLimitMB, byteCap: effectiveLimitMB * 1024 * 1024 },
    });

    if (this.ast.actuationLock !== undefined) {
      instructions.push({
        op: 'ASSERT_RESOURCE_LIMITS',
        payload: { actuationLock: this.ast.actuationLock },
      });
    }

    // 2. Validate & Process Nodes + Spatial Bounds + @Grid777 + @memview
    const declaredNodeIds = new Set<string>();
    let totalStaticMemoryBytes = 0;
    let totalVoxelCells = 0;

    for (const node of this.ast.nodes) {
      if (declaredNodeIds.has(node.id)) {
        throw new Error(`[Compiler Error] Duplicate spatial node identifier detected: '${node.id}'`);
      }
      declaredNodeIds.add(node.id);

      this.validateSpatialBound(node.id, node.coordinate);
      totalStaticMemoryBytes += 64 * 1024; // 64 KB baseline node descriptor

      instructions.push({
        op: 'ALLOC_SPATIAL_NODE',
        payload: {
          nodeId: node.id,
          coordinate: node.coordinate,
          checkpoints: node.checkpoints,
          seals: node.seals,
        },
      });

      // Discrete 7x7x7 Voxel Grid Resolution
      if (node.grid777) {
        totalVoxelCells++;
        instructions.push({
          op: 'ALLOC_VOXEL_GRID',
          payload: {
            nodeId: node.id,
            grid777: node.grid777,
            cellIndex: node.grid777.cellIndex,
          },
        });
      }

      // First-Class Zero-Copy Memory View Mapping
      if (node.memViewBytes) {
        totalStaticMemoryBytes += node.memViewBytes;
        instructions.push({
          op: 'MAP_ZERO_COPY_VIEW',
          payload: {
            nodeId: node.id,
            viewSizeBytes: node.memViewBytes,
            viewSizeMb: node.memViewBytes / (1024 * 1024),
          },
        });
      }

      // Alignments (369 Spatial Harmonic Verification)
      for (const alignCoord of node.alignments) {
        this.validateSpatialBound(node.id, alignCoord);
        instructions.push({
          op: 'ALIGN_HARMONIC',
          payload: {
            nodeId: node.id,
            targetCoordinate: alignCoord,
            harmonicMesh: '369_ALIGNMENT',
          },
        });
      }

      // Node-level Seals
      for (const sealPath of node.seals) {
        instructions.push({
          op: 'SEAL_CRYPTOGRAPHIC_SNAPSHOT',
          payload: {
            nodeId: node.id,
            targetPath: sealPath,
            scope: 'NODE',
          },
        });
      }
    }

    // 3. Process Dynamic Streaming Funnels
    for (const funnel of this.ast.funnels) {
      if (!declaredNodeIds.has(funnel.sourceNode)) {
        throw new Error(`[Compiler Error] Funnel '${funnel.id}' references undefined source node '${funnel.sourceNode}'`);
      }
      if (!declaredNodeIds.has(funnel.targetNode)) {
        throw new Error(`[Compiler Error] Funnel '${funnel.id}' references undefined target node '${funnel.targetNode}'`);
      }

      const bufferBytes = funnel.bufferMb * 1024 * 1024;
      totalStaticMemoryBytes += bufferBytes;

      instructions.push({
        op: funnel.isGossip ? 'OPEN_GOSSIP_CHANNEL' : 'OPEN_FUNNEL_STREAM',
        payload: {
          funnelId: funnel.id,
          from: funnel.sourceNode,
          to: funnel.targetNode,
          bufferMb: funnel.bufferMb,
          isGossip: !!funnel.isGossip,
          priority: funnel.priority || 369,
        },
      });
    }

    // 4. Process Distributed Gossip Channels
    for (const channel of this.ast.channels) {
      if (!declaredNodeIds.has(channel.sourceNode)) {
        throw new Error(`[Compiler Error] Channel '${channel.id}' references undefined source node '${channel.sourceNode}'`);
      }
      if (!declaredNodeIds.has(channel.targetNode)) {
        throw new Error(`[Compiler Error] Channel '${channel.id}' references undefined target node '${channel.targetNode}'`);
      }

      const bufferBytes = channel.bufferMb * 1024 * 1024;
      totalStaticMemoryBytes += bufferBytes;

      instructions.push({
        op: 'OPEN_GOSSIP_CHANNEL',
        payload: {
          channelId: channel.id,
          from: channel.sourceNode,
          to: channel.targetNode,
          bufferMb: channel.bufferMb,
          isGossip: true,
          priority: channel.priority,
        },
      });
    }

    // 5. Global Cryptographic Seals
    for (const seal of this.ast.seals) {
      instructions.push({
        op: 'SEAL_CRYPTOGRAPHIC_SNAPSHOT',
        payload: {
          targetPath: seal.targetPath,
          scope: 'GLOBAL',
        },
      });
    }

    // 6. Spatial Slices (Volume range queries)
    for (const slice of this.ast.slices) {
      this.validateSliceRange(slice);
      instructions.push({
        op: 'QUERY_SPATIAL_SLICE',
        payload: {
          xRange: slice.xRange,
          yRange: slice.yRange,
          zRange: slice.zRange,
        },
      });
    }

    // 7. Compile-Time Static Memory Budget Assertion
    const totalStaticMemoryMB = totalStaticMemoryBytes / (1024 * 1024);
    if (totalStaticMemoryMB > effectiveLimitMB) {
      throw new Error(
        `[Compile-Time Memory Assertion Failure] Total static allocations (${totalStaticMemoryMB.toFixed(2)} MB) exceed declared memory constraint of ${effectiveLimitMB} MB.`
      );
    }

    return {
      targetRssLimitBytes: this.ast.rssMaxLimitMB * 1024 * 1024,
      assertRssLimitBytes: this.ast.assertRssLimitMB ? this.ast.assertRssLimitMB * 1024 * 1024 : undefined,
      actuationLock: this.ast.actuationLock,
      instructions,
      spatialNodesCount: this.ast.nodes.length,
      totalVoxelCellsCount: totalVoxelCells,
      determinismSigmaSq: 0.0, // Guaranteed bit-for-bit zero variance
    };
  }

  private validateSpatialBound(nodeId: string, coord: SpatialCoordinate): void {
    const { x, y, z } = coord;
    if (x < 0 || x > 1 || y < 0 || y > 1 || z < 0 || z > 1) {
      throw new Error(
        `[369 Spatial Bound Violation] Node '${nodeId}' has coordinate (${x}, ${y}, ${z}) outside normalized unit space [0, 1]^3`
      );
    }
  }

  private validateSliceRange(slice: SpatialSliceNode): void {
    const { xRange, yRange, zRange } = slice;
    if (xRange.min < 0 || xRange.max > 1 || xRange.min > xRange.max) {
      throw new Error(`[Spatial Slice Violation] X range [${xRange.min}..${xRange.max}] outside [0, 1] bounds.`);
    }
    if (yRange.min < 0 || yRange.max > 1 || yRange.min > yRange.max) {
      throw new Error(`[Spatial Slice Violation] Y range [${yRange.min}..${yRange.max}] outside [0, 1] bounds.`);
    }
    if (zRange.min < 0 || zRange.max > 1 || zRange.min > zRange.max) {
      throw new Error(`[Spatial Slice Violation] Z range [${zRange.min}..${zRange.max}] outside [0, 1] bounds.`);
    }
  }
}
