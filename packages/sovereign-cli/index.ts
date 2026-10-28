/**
 * @one-lang/sovereign-cli
 * Interactive Sovereign Pipeline CLI Engine
 * Sovereign Architecture | Zero Cloud Dependency
 */

import { NLPSpatialParser, ParsedSpatialProgramIntent } from '../nlp-parser';
import { SpatialASTEmitter, NLPEmissionResult } from '../ast-emitter';
import { PQCLatticeSealEngine, PQCMeshGuard, MeshPacket, VerificationVerdict } from '../pqc-lattice';
import { TimeTravelManager, SystemStateSnapshot } from '../time-travel';

export interface SovereignPipelineReport {
  prompt: string;
  intent: ParsedSpatialProgramIntent;
  emission: NLPEmissionResult;
  pqcSeal: string;
  packetVerification: VerificationVerdict;
  initialCheckpoint: SystemStateSnapshot;
  rewoundState: SystemStateSnapshot;
  deterministicMatch: boolean;
}

export class SovereignCLIEngine {
  public readonly parser: NLPSpatialParser;
  public readonly emitter: SpatialASTEmitter;
  public readonly meshGuard: PQCMeshGuard;
  public readonly timeTravel: TimeTravelManager;

  constructor() {
    this.parser = new NLPSpatialParser();
    this.emitter = new SpatialASTEmitter();
    this.meshGuard = new PQCMeshGuard();
    this.timeTravel = new TimeTravelManager();
  }

  /**
   * Executes the complete end-to-end pipeline from natural language prompt to PQC and time-travel rewind.
   */
  public executeFullPipeline(prompt: string): SovereignPipelineReport {
    // 1. NLP Parse
    const intent = this.parser.parsePrompt(prompt);

    // 2. AST Emission
    const emission = this.emitter.compilePromptToAST(intent);

    // 3. PQC Lattice Root Seal
    const dataBuf = Buffer.from(prompt + emission.generatedSourceCode, 'utf-8');
    const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(dataBuf);

    // 4. Mesh Guard Packet Sign & Verify
    this.meshGuard.registerTrustedPeer(intent.nodes[0]?.nodeId || 'Node_Alpha');
    const pkt = this.meshGuard.signPacket(
      intent.nodes[0]?.nodeId || 'Node_Alpha',
      intent.nodes[1]?.nodeId || 'Node_Beta',
      { instructionsCount: emission.compiledAst.instructions.length }
    );
    const packetVerification = this.meshGuard.verifyIncomingPacket(pkt);

    // 5. Time-Travel Snapshot & Rewind
    const actors = intent.nodes.map((n, idx) => ({
      id: n.nodeId,
      frequency: [9, 6, 3][idx % 3],
      mailboxSize: 0,
      stateVector: [0.369, 0.693, 0.936, 1.0],
    }));

    const initialCheckpoint = this.timeTravel.captureSnapshot('CP_INIT_001', { nodes: intent.nodes }, actors, intent.rssMaxMb);

    // Simulate mutation
    actors[0].stateVector = [0.999, 0.999, 0.999, 1.0];

    // Rewind
    const rewoundState = this.timeTravel.rewindToSnapshot('CP_INIT_001');

    const deterministicMatch = JSON.stringify(initialCheckpoint.actorStates) === JSON.stringify(rewoundState.actorStates);

    return {
      prompt,
      intent,
      emission,
      pqcSeal,
      packetVerification,
      initialCheckpoint,
      rewoundState,
      deterministicMatch,
    };
  }
}
