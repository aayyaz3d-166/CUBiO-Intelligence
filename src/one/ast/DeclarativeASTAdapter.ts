import { ProgramNode } from '../oneParser';
import { UnifiedProgramNode, DeclarativeSpatialNodeWrapper } from './UnifiedAST';

export class DeclarativeASTAdapter {
  /**
   * Adapts existing Declarative DSL ProgramNode into canonical UnifiedProgramNode.
   * Completely preserves spatial node coordinates, alignments, checkpoints, funnels,
   * channels, seals, slices, and RSS boundaries.
   */
  public static adapt(program: ProgramNode): UnifiedProgramNode {
    const body: DeclarativeSpatialNodeWrapper[] = [];

    // 1. Wrap Node Declarations
    for (const node of program.nodes) {
      body.push({
        kind: 'DeclarativeSpatialNode',
        nodeType: 'Node',
        payload: {
          id: node.id,
          coordinate: node.coordinate,
          grid777: node.grid777,
          alignments: node.alignments,
          checkpoints: node.checkpoints,
          seals: node.seals,
          memViewBytes: node.memViewBytes,
        },
      });
    }

    // 2. Wrap Funnels
    for (const funnel of program.funnels) {
      body.push({
        kind: 'DeclarativeSpatialNode',
        nodeType: 'Funnel',
        payload: {
          id: funnel.id,
          sourceNode: funnel.sourceNode,
          targetNode: funnel.targetNode,
          bufferMb: funnel.bufferMb,
          isGossip: funnel.isGossip,
          priority: funnel.priority,
        },
      });
    }

    // 3. Wrap Channels
    for (const channel of program.channels) {
      body.push({
        kind: 'DeclarativeSpatialNode',
        nodeType: 'Channel',
        payload: {
          id: channel.id,
          sourceNode: channel.sourceNode,
          targetNode: channel.targetNode,
          bufferMb: channel.bufferMb,
          isGossip: channel.isGossip,
          priority: channel.priority,
        },
      });
    }

    // 4. Wrap Seals
    for (const seal of program.seals) {
      body.push({
        kind: 'DeclarativeSpatialNode',
        nodeType: 'Seal',
        payload: {
          targetPath: seal.targetPath,
          scope: seal.scope,
        },
      });
    }

    // 5. Wrap Slices
    for (const slice of program.slices) {
      body.push({
        kind: 'DeclarativeSpatialNode',
        nodeType: 'Slice',
        payload: {
          id: slice.id,
          xRange: slice.xRange,
          yRange: slice.yRange,
          zRange: slice.zRange,
        },
      });
    }

    return {
      kind: 'Program',
      declarativeMeta: {
        rssMaxLimitMB: program.rssMaxLimitMB,
        assertRssLimitMB: program.assertRssLimitMB,
        actuationLock: program.actuationLock,
      },
      body,
    };
  }
}
