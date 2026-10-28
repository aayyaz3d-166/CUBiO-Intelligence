/**
 * @one-lang/nlp-parser
 * Standalone Bilingual (Roman Urdu + English) Spatial Natural Language Parser
 * Sovereign Architecture | Zero Cloud Dependency
 */

export interface SpatialNodeIntent {
  nodeId: string;
  coordinate: [number, number, number];
  memViewMb: number;
}

export interface SpatialChannelIntent {
  channelName: string;
  sourceNode: string;
  targetNode: string;
  bufferMb: number;
  harmonicPriority: number;
}

export interface ParsedSpatialProgramIntent {
  rawPrompt: string;
  languageDetected: 'ROMAN_URDU' | 'ENGLISH';
  nodes: SpatialNodeIntent[];
  channels: SpatialChannelIntent[];
  rssMaxMb: number;
  assertRssMb: number;
  actuationLock: boolean;
  sealFilename: string;
  confidenceScore: number;
}

export class NLPSpatialParser {
  private romanUrduKeywords = ['banao', 'rakho', 'jismein', 'aur', 'par', 'sync', 'karo', 'ka', 'ke', 'chalayein'];
  private englishKeywords = ['create', 'spatial', 'mesh', 'topology', 'containing', 'with', 'channel', 'stream'];

  /**
   * Detects whether a prompt is written in Roman Urdu or English.
   */
  public detectLanguage(prompt: string): 'ROMAN_URDU' | 'ENGLISH' {
    const tokens = prompt.toLowerCase().split(/\s+/);
    let urduCount = 0;
    let engCount = 0;

    for (const t of tokens) {
      if (this.romanUrduKeywords.includes(t)) urduCount++;
      if (this.englishKeywords.includes(t)) engCount++;
    }

    return urduCount >= engCount && urduCount > 0 ? 'ROMAN_URDU' : 'ENGLISH';
  }

  /**
   * Parses natural language prompt into structured spatial program intent.
   */
  public parsePrompt(prompt: string): ParsedSpatialProgramIntent {
    const lang = this.detectLanguage(prompt);
    const lower = prompt.toLowerCase();

    // 1. Extract Memory Limits
    let rssMax = 512;
    const memMatch = prompt.match(/(\d+)\s*(mb|megabytes|mb memory)/i);
    if (memMatch) {
      rssMax = parseInt(memMatch[1], 10);
    }

    // 2. Extract Named Nodes
    const nodes: SpatialNodeIntent[] = [];
    const nodeMatches = prompt.match(/Node\s*([A-Za-z0-9_]+)/gi) || [];

    const uniqueNodeNames = Array.from(
      new Set(nodeMatches.map((m) => m.replace(/Node\s*/i, 'Node_')))
    );

    if (uniqueNodeNames.length === 0) {
      uniqueNodeNames.push('Node_Alpha', 'Node_Beta');
    }

    const defaultCoords: [number, number, number][] = [
      [0.1, 0.2, 0.3],
      [0.9, 0.8, 0.9],
      [0.5, 0.5, 0.5],
      [0.3, 0.6, 0.9],
    ];

    uniqueNodeNames.forEach((name, idx) => {
      nodes.push({
        nodeId: name,
        coordinate: defaultCoords[idx % defaultCoords.length],
        memViewMb: 16,
      });
    });

    // 3. Extract Channels
    const channels: SpatialChannelIntent[] = [];
    if (nodes.length >= 2) {
      channels.push({
        channelName: 'SpatialQuantumChannel',
        sourceNode: nodes[0].nodeId,
        targetNode: nodes[1].nodeId,
        bufferMb: 32,
        harmonicPriority: 369,
      });
    }

    return {
      rawPrompt: prompt,
      languageDetected: lang,
      nodes,
      channels,
      rssMaxMb: rssMax,
      assertRssMb: rssMax,
      actuationLock: true,
      sealFilename: 'nlp_spatial_state.3dmemory',
      confidenceScore: 0.995,
    };
  }
}
