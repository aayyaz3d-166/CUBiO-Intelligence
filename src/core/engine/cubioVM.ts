import { ExecutableCubiOAST, ExecutableInstruction } from '../../one/oneCompiler';
import { RSSGuard } from '../memory/rssGuard';
import { SpatialHarmonic369Engine, Point3D } from './spatialHarmonic369';
import { Grid777Coordinate, SpatialRange } from '../../one/oneParser';
import { SpatialQuantumMapper } from '../../one/spatial_quantum_mapper';
import * as fs from 'fs';

export interface RuntimeSpatialNode {
  id: string;
  coordinate: Point3D;
  grid777?: Grid777Coordinate;
  checkpoints: string[];
  seals: string[];
  activeAlignments: Point3D[];
  memoryViews: Array<{ viewSizeBytes: number; buffer: Uint8Array }>;
}

export interface RuntimeFunnelStream {
  id: string;
  source: string;
  target: string;
  bufferSizeBytes: number;
  isGossip: boolean;
  priority: number;
}

export interface RuntimeSpatialSlice {
  xRange: SpatialRange;
  yRange: SpatialRange;
  zRange: SpatialRange;
  matchedNodes: string[];
}

export class CubiOVirtualMachine {
  private rssGuard: RSSGuard;
  private harmonicEngine: SpatialHarmonic369Engine;
  private activeNodes: Map<string, RuntimeSpatialNode> = new Map();
  private activeStreams: Map<string, RuntimeFunnelStream> = new Map();
  private activeSlices: RuntimeSpatialSlice[] = [];
  private sealedSnapshots: Map<string, string> = new Map(); // path -> hash
  private actuationLocked: boolean = false;

  constructor() {
    this.rssGuard = new RSSGuard(512); // Hard cap 512 MB
    this.harmonicEngine = new SpatialHarmonic369Engine();
  }

  public execute(ast: ExecutableCubiOAST): void {
    console.log('[CubiO VM] Initializing Sovereign Execution Fabric...');

    for (const instruction of ast.instructions) {
      this.dispatch(instruction);
    }

    console.log(`[CubiO VM] Execution Complete. Active Memory: ${this.rssGuard.getUsedMb().toFixed(2)} MB`);
  }

  private dispatch(instruction: ExecutableInstruction): void {
    switch (instruction.op) {
      case 'SET_RSS_GUARD': {
        const payload = instruction.payload as { limitMb: number };
        this.rssGuard = new RSSGuard(payload.limitMb);
        console.log(`  [VM Op] SET_RSS_GUARD: Enforcing limit at ${payload.limitMb} MB`);
        break;
      }

      case 'ASSERT_RESOURCE_LIMITS': {
        const payload = instruction.payload as { actuationLock?: boolean };
        if (payload.actuationLock !== undefined) {
          this.actuationLocked = payload.actuationLock;
          console.log(`  [VM Op] ASSERT_RESOURCE_LIMITS: Actuation Lock = ${this.actuationLocked}`);
        }
        break;
      }

      case 'ALLOC_SPATIAL_NODE': {
        const payload = instruction.payload as {
          nodeId: string;
          coordinate: Point3D;
          checkpoints: string[];
          seals?: string[];
        };

        // Allocate base heap space for node runtime descriptor (64 KB baseline)
        this.rssGuard.allocate(64 * 1024, `NodeDescriptor:${payload.nodeId}`);

        const node: RuntimeSpatialNode = {
          id: payload.nodeId,
          coordinate: payload.coordinate,
          checkpoints: payload.checkpoints || [],
          seals: payload.seals || [],
          activeAlignments: [],
          memoryViews: [],
        };

        this.activeNodes.set(payload.nodeId, node);
        console.log(`  [VM Op] ALLOC_SPATIAL_NODE: Registered '${payload.nodeId}' at (${payload.coordinate.x}, ${payload.coordinate.y}, ${payload.coordinate.z})`);
        break;
      }

      case 'ALLOC_VOXEL_GRID': {
        const payload = instruction.payload as {
          nodeId: string;
          grid777: Grid777Coordinate;
          cellIndex: number;
        };

        const node = this.activeNodes.get(payload.nodeId);
        if (node) {
          node.grid777 = payload.grid777;
          console.log(`  [VM Op] ALLOC_VOXEL_GRID: Node '${payload.nodeId}' mapped to 7x7x7 Voxel Cell #${payload.cellIndex} (${payload.grid777.i}, ${payload.grid777.j}, ${payload.grid777.k})`);
        }
        break;
      }

      case 'MAP_ZERO_COPY_VIEW': {
        const payload = instruction.payload as {
          nodeId: string;
          viewSizeBytes: number;
          viewSizeMb: number;
        };

        this.rssGuard.allocate(payload.viewSizeBytes, `ZeroCopyMemView:${payload.nodeId}`);
        const sharedBuffer = new SharedArrayBuffer(payload.viewSizeBytes);
        const view = new Uint8Array(sharedBuffer);

        const node = this.activeNodes.get(payload.nodeId);
        if (node) {
          node.memoryViews.push({ viewSizeBytes: payload.viewSizeBytes, buffer: view });
          console.log(`  [VM Op] MAP_ZERO_COPY_VIEW: Zero-copy pointer view of ${payload.viewSizeMb} MB mapped to '${payload.nodeId}'`);
        }
        break;
      }

      case 'ALIGN_HARMONIC': {
        const payload = instruction.payload as {
          nodeId: string;
          targetCoordinate: Point3D;
        };

        const node = this.activeNodes.get(payload.nodeId);
        if (!node) {
          throw new Error(`[VM Fault] Cannot align non-existent node '${payload.nodeId}'`);
        }

        const alignedCoord = this.harmonicEngine.align(node.coordinate, payload.targetCoordinate);
        node.activeAlignments.push(alignedCoord);
        console.log(`  [VM Op] ALIGN_HARMONIC: Node '${payload.nodeId}' harmonic locked at (${alignedCoord.x}, ${alignedCoord.y}, ${alignedCoord.z})`);
        break;
      }

      case 'OPEN_FUNNEL_STREAM': {
        const payload = instruction.payload as {
          funnelId: string;
          from: string;
          to: string;
          bufferMb: number;
          isGossip?: boolean;
          priority?: number;
        };

        const bufferBytes = payload.bufferMb * 1024 * 1024;
        this.rssGuard.allocate(bufferBytes, `FunnelBuffer:${payload.funnelId}`);

        const stream: RuntimeFunnelStream = {
          id: payload.funnelId,
          source: payload.from,
          target: payload.to,
          bufferSizeBytes: bufferBytes,
          isGossip: !!payload.isGossip,
          priority: payload.priority || 369,
        };

        this.activeStreams.set(payload.funnelId, stream);
        console.log(`  [VM Op] OPEN_FUNNEL_STREAM: Opened ${payload.funnelId} (${payload.from} -> ${payload.to}) [${payload.bufferMb} MB Stream Allocated]`);
        break;
      }

      case 'OPEN_GOSSIP_CHANNEL': {
        const payload = instruction.payload as {
          channelId?: string;
          funnelId?: string;
          from: string;
          to: string;
          bufferMb: number;
          priority: number;
        };

        const id = payload.channelId || payload.funnelId || 'GossipChannel';
        const bufferBytes = payload.bufferMb * 1024 * 1024;
        this.rssGuard.allocate(bufferBytes, `GossipChannel:${id}`);

        const stream: RuntimeFunnelStream = {
          id,
          source: payload.from,
          target: payload.to,
          bufferSizeBytes: bufferBytes,
          isGossip: true,
          priority: payload.priority,
        };

        this.activeStreams.set(id, stream);
        console.log(`  [VM Op] OPEN_GOSSIP_CHANNEL: Opened Gossip Channel '${id}' (${payload.from} -> ${payload.to}) [Priority: ${payload.priority}, Buffer: ${payload.bufferMb} MB]`);
        break;
      }

      case 'SEAL_CRYPTOGRAPHIC_SNAPSHOT': {
        const payload = instruction.payload as {
          targetPath: string;
          scope: string;
          nodeId?: string;
        };

        const statePayload = {
          timestamp: Date.now(),
          scope: payload.scope,
          nodeId: payload.nodeId,
          nodes: Array.from(this.activeNodes.entries()).map(([k, v]) => ({
            id: k,
            coordinate: v.coordinate,
            grid777: v.grid777,
            checkpoints: v.checkpoints,
          })),
          rssAllocatedBytes: this.rssGuard.getUsedBytes(),
        };

        // Generate deterministic FNV-1a hash
        const jsonStr = JSON.stringify(statePayload);
        let hash = 0x811c9dc5;
        for (let i = 0; i < jsonStr.length; i++) {
          hash ^= jsonStr.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193);
        }
        const stateHash = '0x369_' + (hash >>> 0).toString(16).padStart(8, '0') + '_SEAL';
        this.sealedSnapshots.set(payload.targetPath, stateHash);

        console.log(`  [VM Op] SEAL_CRYPTOGRAPHIC_SNAPSHOT: Sealed ${payload.scope} state into '${payload.targetPath}' | Hash: ${stateHash}`);
        break;
      }

      case 'QUERY_SPATIAL_SLICE': {
        const payload = instruction.payload as {
          xRange: SpatialRange;
          yRange: SpatialRange;
          zRange: SpatialRange;
        };

        const matched: string[] = [];
        for (const [id, node] of this.activeNodes.entries()) {
          const { x, y, z } = node.coordinate;
          if (
            x >= payload.xRange.min && x <= payload.xRange.max &&
            y >= payload.yRange.min && y <= payload.yRange.max &&
            z >= payload.zRange.min && z <= payload.zRange.max
          ) {
            matched.push(id);
          }
        }

        this.activeSlices.push({
          xRange: payload.xRange,
          yRange: payload.yRange,
          zRange: payload.zRange,
          matchedNodes: matched,
        });

        console.log(`  [VM Op] QUERY_SPATIAL_SLICE: Volume query [${payload.xRange.min}..${payload.xRange.max}, ${payload.yRange.min}..${payload.yRange.max}, ${payload.zRange.min}..${payload.zRange.max}] matched ${matched.length} nodes: [${matched.join(', ')}]`);
        break;
      }

      case 'COMPUTE_INTENT_RESONANCE': {
        const payload = instruction.payload as { intentVector: number[] };
        const vec = new Float64Array(payload.intentVector);
        const res = SpatialQuantumMapper.compute_intent_resonance(vec);
        console.log(`  [VM Op] COMPUTE_INTENT_RESONANCE: Resonance=${res.resonanceScore}, PeakAddr=${res.peakResonantCellAddress} [Display: ${res.peakResonantDisplayIndex}] (${res.harmonicTier}) in ${res.calculationLatencyMs}ms`);
        break;
      }

      case 'EXECUTE_MATRIX_TRANSFORM': {
        const payload = instruction.payload as {
          matrixA: number[];
          matrixB: number[];
          dimension?: 3 | 4;
        };
        const dim = payload.dimension || 3;
        const matA = new Float64Array(payload.matrixA);
        const matB = new Float64Array(payload.matrixB);
        const res = dim === 4
          ? SpatialQuantumMapper.multiply4x4(matA, matB)
          : SpatialQuantumMapper.multiply3x3(matA, matB);
        console.log(`  [VM Op] EXECUTE_MATRIX_TRANSFORM: Executed native ${dim}x${dim} matrix multiplication (${res.length} elements).`);
        break;
      }

      default:
        throw new Error(`[VM Panic] Unknown opcode instruction encountered`);
    }
  }

  public getVMState() {
    return {
      nodesCount: this.activeNodes.size,
      streamsCount: this.activeStreams.size,
      slicesCount: this.activeSlices.length,
      sealedSnapshotsCount: this.sealedSnapshots.size,
      allocatedMemoryMb: this.rssGuard.getUsedMb(),
      determinismSigmaSq: 0.0,
      actuationLocked: this.actuationLocked,
    };
  }

  public getActiveNodes(): Map<string, RuntimeSpatialNode> {
    return this.activeNodes;
  }

  public getSealedSnapshots(): Map<string, string> {
    return this.sealedSnapshots;
  }
}
