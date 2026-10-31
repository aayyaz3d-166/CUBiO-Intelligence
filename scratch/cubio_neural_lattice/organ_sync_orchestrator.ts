/**
 * CUBiO Organ Synchronization Orchestrator ("one-soma")
 * Gate: CNL-P31-001 | Sovereign Architecture ("one-soma")
 *
 * Implements master closed-loop biological feedback linking:
 * — Prefrontal Executive Cortex (Gate 30)
 * — Autonomic Heart & Pacemaker (Gate 28)
 * — Autonomous Immune Shield (Gate 29)
 * — Physical Rover Fleet (Gate 27)
 *
 * Drives continuous homeostatic adaptation across the unified organism
 * under permanent fail-closed PQC safety enforcement.
 */

import { SomaBusInterconnect, SomaBusPacket } from './soma_bus_interconnect';
import { PrefrontalExecutiveEngine } from './prefrontal_executive_engine';
import { HeartPacemakerCore, PacemakerRhythmState } from './heart_pacemaker_core';
import { AutonomousImmuneShield, ThreatVector } from './autonomous_immune_shield';
import {
  PhysicalRoverFieldEngine,
  RoverFieldTelemetry,
  RoverFusedFieldState,
  ActuationClearanceToken,
  ActuationVerificationResult,
} from './physical_rover_field_engine';
import { SovereignLTMCore } from './sovereign_cognitive_core';
import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export interface OrganSyncFeedbackReport {
  cortexToHeartPacingShift: {
    previousRhythm: PacemakerRhythmState;
    newRhythm: PacemakerRhythmState;
    harmonicFreqMhz: 3 | 6 | 9;
  };
  roverObstacleFeedback: {
    roverId: string;
    obstacleCoord: [number, number, number];
    admittedToWorkingMemory: boolean;
  };
  immuneSurveillanceFeedback: {
    threatsQuarantined: number;
    postAttackEntropyBits: number;
    quarantineEfficiencyPct: number;
  };
  pqcSyncSeal: string;
}

export class OrganSyncOrchestrator {
  public readonly bus: SomaBusInterconnect;
  public readonly cortex: PrefrontalExecutiveEngine;
  public readonly heart: HeartPacemakerCore;
  public readonly immune: AutonomousImmuneShield;
  public readonly roverEngine: PhysicalRoverFieldEngine;
  public readonly ltm: SovereignLTMCore;

  public readonly is_actuation_blocked: boolean = true; // Permanent fail-closed invariant

  private feedbackHistory: OrganSyncFeedbackReport[] = [];

  constructor() {
    this.bus = new SomaBusInterconnect();
    this.cortex = new PrefrontalExecutiveEngine(7, 0.45);
    this.heart = new HeartPacemakerCore();
    this.immune = new AutonomousImmuneShield();
    this.roverEngine = new PhysicalRoverFieldEngine();
    this.ltm = new SovereignLTMCore();

    this.wireOrganBusSubscribers();
  }

  /**
   * Wires cross-organ event subscribers over the Soma Bus.
   */
  private wireOrganBusSubscribers(): void {
    // 1. Heart listens for Cortex homeostatic pacing signals
    this.bus.subscribe('HEART_AUTONOMIC', (packet: SomaBusPacket) => {
      if (packet.eventType === 'HOMEOSTATIC_FEEDBACK_SIGNAL') {
        const { targetRhythm } = packet.payload as { targetRhythm: PacemakerRhythmState };
        if (targetRhythm) {
          this.heart.setRhythmState(targetRhythm);
        }
      }
    });

    // 2. Cortex listens for Rover telemetry stream & Immune alerts
    this.bus.subscribe('CORTEX_PREFRONTAL', (packet: SomaBusPacket) => {
      if (packet.eventType === 'ROVER_TELEMETRY_STREAM') {
        const state = packet.payload as RoverFusedFieldState;
        // Arbitrate obstacle into working memory with high priority
        this.cortex.arbitrateIntent(
          `NAV_OBSTACLE_${state.roverId}`,
          85,
          `Avoid obstacle at voxel [${state.obstacleCoord3D.join(',')}]`,
          ['RE_ROUTE_VOXEL', 'CLEAR_TRAJECTORY'],
          false
        );
      } else if (packet.eventType === 'IMMUNE_QUARANTINE_ALERT') {
        const alert = packet.payload as { threatClass: string; severity: string };
        // Elevate security priority in cortex
        this.cortex.arbitrateIntent(
          `SECURITY_OVERRIDE_${alert.threatClass}`,
          99,
          `Immune alert: ${alert.threatClass} quarantined`,
          ['LOCK_DOWN', 'REINFORCE_PQC'],
          true
        );
      }
    });
  }

  /**
   * Executes a synchronized multi-organ biological feedback round.
   */
  public executeOrganSyncRound(sequenceNumber: number = 1): OrganSyncFeedbackReport {
    // ── 1. Heart SA Node Pulse Broadcast ─────────────────────────────────────
    const initialRhythm = this.heart.getCurrentRhythmState();
    this.heart.fireActionPotentials(3);
    this.bus.dispatch('HEART_PULSE_BROADCAST', 'HEART_AUTONOMIC', 'BROADCAST_ALL', {
      rhythmState: initialRhythm,
      frequencyMhz: this.heart.getFrequencyMhz(),
      hrvCoefficient: this.heart.getHRVCoefficient(),
    });

    // ── 2. Cortex registers strategic mission goals & modulates Heart ────────
    this.cortex.arbitrateIntent(
      `MISSION_GOAL_ALPHA_${sequenceNumber}`,
      92,
      'Execute high-frequency autonomous terrain exploration and AST mutation',
      ['STEP_SCAN', 'STEP_ANALYZE']
    );

    // Dynamic pacing shift: High cognitive demand shifts heart from REST to ACTIVE/TACHYCARDIC
    const newRhythm: PacemakerRhythmState = 'SYSTOLIC_ACTIVE';
    this.bus.dispatch('HOMEOSTATIC_FEEDBACK_SIGNAL', 'CORTEX_PREFRONTAL', 'HEART_AUTONOMIC', {
      targetRhythm: newRhythm,
      reason: 'HIGH_COGNITIVE_DEMAND_GOAL',
    });

    // ── 3. Physical Rover Telemetry Ingestion & Fusion ───────────────────────
    const roverTelemetry: RoverFieldTelemetry = {
      roverId: 'ROVER_ALPHA_SOMA',
      lidarDistanceMeters: 6.8,
      lidarPointCount: 2048,
      imuAcceleration: [0.05, -0.02, 9.81],
      imuAngularVelocity: [0.04, -0.01, 0.08],
      thermalKelvin: 298.15,
      pressureKPa: 101.325,
      timestamp: 1725905000000 + sequenceNumber,
    };

    const fusedRoverState = this.roverEngine.fuseRoverFieldTelemetry(roverTelemetry, sequenceNumber);
    this.bus.dispatch('ROVER_TELEMETRY_STREAM', 'ROVER_FLEET', 'CORTEX_PREFRONTAL', fusedRoverState);

    // ── 4. Immune Surveillance & Autonomous Quarantine ───────────────────────
    const testThreat: ThreatVector = {
      threatId: `SOMA_ROGUE_PKT_${sequenceNumber}`,
      threatClass: 'ROGUE_PACKET',
      sourceNodeId: 'EXTERNAL_MALICIOUS_PROBE',
      payloadHash: '0xMALICIOUS_BYTECODE_INJECTION',
      detectedAt: 1725905000000 + sequenceNumber,
      severity: 'CRITICAL',
      rawEvidence: 'Unverified packet injected on external interface without PQC header',
    };

    const quarantineRecord = this.immune.detectAndQuarantine(testThreat);
    this.bus.dispatch('IMMUNE_QUARANTINE_ALERT', 'IMMUNE_SHIELD', 'CORTEX_PREFRONTAL', {
      threatClass: testThreat.threatClass,
      severity: testThreat.severity,
      quarantineId: quarantineRecord.quarantineId,
    });

    const immuneReport = this.immune.generateImmuneShieldReport();

    // ── 5. Evaluate Conditional Actuation Clearance (Fail-Closed Enforcement) ─
    const clearanceToken: ActuationClearanceToken = {
      tokenId: `TOKEN_SOMA_ACTUATION_${sequenceNumber}`,
      roverId: 'ROVER_ALPHA_SOMA',
      targetTrajectory: [1, 0, 0],
      stepDistanceM: 0.50,
      tokenPqcSignature: '',
      timestamp: 1725905000000 + sequenceNumber,
    };
    clearanceToken.tokenPqcSignature = PQCLatticeSealEngine.generatePQCSeal(
      Buffer.from(`SOMA_ACTUATION:${clearanceToken.tokenId}:${clearanceToken.roverId}:0.50`, 'utf-8')
    );

    const actuationResult = this.roverEngine.verifyAndExecuteConditionalActuation(
      clearanceToken,
      fusedRoverState,
      this.is_actuation_blocked
    );

    // ── 6. PQC Seal for Sync Round ───────────────────────────────────────────
    const syncPayload = JSON.stringify({
      gate: 'CNL-P31-001',
      round: sequenceNumber,
      heartRhythm: this.heart.getCurrentRhythmState(),
      roverUUP: fusedRoverState.uupConfidence,
      immuneQuarantinePct: immuneReport.quarantineEfficiencyPct,
      actuationCleared: actuationResult.isCleared,
      actuationBlocked: this.is_actuation_blocked,
    });
    const pqcSyncSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(syncPayload, 'utf-8'));

    const feedbackReport: OrganSyncFeedbackReport = {
      cortexToHeartPacingShift: {
        previousRhythm: initialRhythm,
        newRhythm: this.heart.getCurrentRhythmState(),
        harmonicFreqMhz: this.heart.getFrequencyMhz(),
      },
      roverObstacleFeedback: {
        roverId: fusedRoverState.roverId,
        obstacleCoord: fusedRoverState.obstacleCoord3D,
        admittedToWorkingMemory: true,
      },
      immuneSurveillanceFeedback: {
        threatsQuarantined: immuneReport.totalThreatsQuarantined,
        postAttackEntropyBits: 320,
        quarantineEfficiencyPct: immuneReport.quarantineEfficiencyPct,
      },
      pqcSyncSeal,
    };

    this.feedbackHistory.push(feedbackReport);
    return feedbackReport;
  }

  public getFeedbackHistory(): OrganSyncFeedbackReport[] {
    return this.feedbackHistory;
  }
}
