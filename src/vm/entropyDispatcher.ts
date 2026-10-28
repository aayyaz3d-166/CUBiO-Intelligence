/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Module: Entropy Dispatcher (entropyDispatcher.ts)
 *
 * Implements IDynamicDispatcher to evaluate telemetry (Von Neumann Entropy S(rho) and Bit Density D)
 * prior to opcode execution:
 * - Zone A (High Order): S(rho) < 0.6 => Mutate to COMPACT_CORE_WRITE (0x11). Target Core [3, 3, 3].
 * - Zone B (Balanced):   0.6 <= S(rho) <= 1.4 => Direct fast-path pass (0x02).
 * - Zone C (High Chaos): S(rho) > 1.4 => Parallel Mesh Broadcast (0x12) / outer shell routing + adaptive quantization.
 *
 * Shell Radius Mapping Formula:
 *   r = floor((S(rho) / 2.0) * 3.99) in {0, 1, 2, 3}
 */

import { EntropyAnalysis } from './entropyEngine';
import { BitAgentAnalysis } from './bitAgent';
import { Opcode, Instruction } from './cubioVM';

export type ExecutionZone = 'ZONE_A_HIGH_ORDER' | 'ZONE_B_BALANCED' | 'ZONE_C_HIGH_CHAOS';

export interface DispatchDecision {
  zone: ExecutionZone;
  entropyScore: number;
  bitDensity: number;
  shellRadius: number; // 0, 1, 2, 3
  mutatedOpcode: Opcode;
  suggestedQuantizationBits: 2 | 4 | 8;
  fastPathEligible: boolean;
  parallelDispatchRecommended: boolean;
  reason: string;
}

export interface IDynamicDispatcher {
  classifyZone(entropyScore: number): ExecutionZone;
  mapEntropyToShellRadius(entropyScore: number): number;
  dispatch(entropy: EntropyAnalysis, bitAgent: BitAgentAnalysis): DispatchDecision;
  mutateInstruction(inst: Instruction, decision: DispatchDecision): Instruction;
}

export class EntropyDispatcher implements IDynamicDispatcher {
  /**
   * Zone thresholds
   */
  public static readonly ZONE_A_MAX = 0.6;
  public static readonly ZONE_B_MAX = 1.4;

  /**
   * Classify telemetry into execution zone
   */
  public classifyZone(entropyScore: number): ExecutionZone {
    if (entropyScore < EntropyDispatcher.ZONE_A_MAX) {
      return 'ZONE_A_HIGH_ORDER';
    }
    if (entropyScore <= EntropyDispatcher.ZONE_B_MAX) {
      return 'ZONE_B_BALANCED';
    }
    return 'ZONE_C_HIGH_CHAOS';
  }

  /**
   * Shell Radius Mapping Formula:
   * r = floor((S(rho) / 2.0) * 3.99) clamped to {0, 1, 2, 3}
   */
  public mapEntropyToShellRadius(entropyScore: number): number {
    const clampedEntropy = Math.max(0.0, Math.min(2.0, entropyScore));
    const rawR = Math.floor((clampedEntropy / 2.0) * 3.99);
    return Math.max(0, Math.min(3, rawR));
  }

  /**
   * Compute full dispatch decision based on Entropy & Bitstream telemetry
   */
  public dispatch(entropy: EntropyAnalysis, bitAgent: BitAgentAnalysis): DispatchDecision {
    const s = entropy.vonNeumannEntropy;
    const d = bitAgent.bitDensity;
    const zone = this.classifyZone(s);
    const shellRadius = this.mapEntropyToShellRadius(s);

    let mutatedOpcode: Opcode;
    let suggestedQuantizationBits: 2 | 4 | 8;
    let fastPathEligible: boolean;
    let parallelDispatchRecommended: boolean;
    let reason: string;

    switch (zone) {
      case 'ZONE_A_HIGH_ORDER':
        // High Order: Compact write to core cell [3, 3, 3], no compression needed, zero-copy fast-path
        mutatedOpcode = Opcode.SHELL_ALLOCATE; // 0x11
        suggestedQuantizationBits = 8; // preserve full precision
        fastPathEligible = true;
        parallelDispatchRecommended = false;
        reason = `Zone A (S=${s.toFixed(3)} < 0.6): High order detected. Mutated to COMPACT_CORE_WRITE targeting Shell 0 [3,3,3].`;
        break;

      case 'ZONE_B_BALANCED':
        // Balanced: Standard direct write, standard 8-bit precision
        mutatedOpcode = Opcode.CELL_WRITE; // 0x02
        suggestedQuantizationBits = 8;
        fastPathEligible = bitAgent.fastPathEligible;
        parallelDispatchRecommended = false;
        reason = `Zone B (0.6 <= S=${s.toFixed(3)} <= 1.4): Balanced entropy. Standard direct memory dispatch to Shell ${shellRadius}.`;
        break;

      case 'ZONE_C_HIGH_CHAOS':
        // High Chaos: Disperse across outer shells with parallel mesh broadcast and adaptive quantization (4-bit or 2-bit)
        mutatedOpcode = Opcode.PARALLEL_MESH_DISPATCH; // 0x12
        suggestedQuantizationBits = s > 1.8 ? 2 : 4;
        fastPathEligible = false;
        parallelDispatchRecommended = true;
        reason = `Zone C (S=${s.toFixed(3)} > 1.4): High entropy chaos. Mutated to PARALLEL_MESH_DISPATCH to Shell ${shellRadius} with ${suggestedQuantizationBits}-bit quantization.`;
        break;
    }

    return {
      zone,
      entropyScore: s,
      bitDensity: d,
      shellRadius,
      mutatedOpcode,
      suggestedQuantizationBits,
      fastPathEligible,
      parallelDispatchRecommended,
      reason,
    };
  }

  /**
   * Mutate instruction opcode and parameters based on dispatch decision
   */
  public mutateInstruction(inst: Instruction, decision: DispatchDecision): Instruction {
    const mutated: Instruction = { ...inst };

    // If instruction is CELL_WRITE or ROUTED_WRITE, mutate according to zone specification
    if (inst.op === Opcode.CELL_WRITE || inst.op === Opcode.ROUTED_WRITE) {
      mutated.comment = `[Mutated by Dispatcher: ${decision.zone}] ${inst.comment ?? ''}`;

      if (decision.zone === 'ZONE_A_HIGH_ORDER') {
        // Zone A (High Order): S(rho) < 0.6 => Mutate write to COMPACT_CORE_WRITE (0x11). Target Core [3,3,3].
        mutated.op = Opcode.SHELL_ALLOCATE; // 0x11
        mutated.coord = { x: 3, y: 3, z: 3 };
        mutated.shellRadius = 0;
      } else if (decision.zone === 'ZONE_B_BALANCED') {
        // Zone B (Balanced): 0.6 <= S(rho) <= 1.4 => Direct fast-path pass (0x02).
        mutated.op = Opcode.CELL_WRITE; // 0x02
        if (!mutated.coord) {
          mutated.shellRadius = decision.shellRadius;
        }
      } else if (decision.zone === 'ZONE_C_HIGH_CHAOS') {
        // Zone C (High Chaos): S(rho) > 1.4 => Parallel Mesh Broadcast (0x12). Route to outer shells and enable adaptive quantization.
        mutated.op = Opcode.PARALLEL_MESH_DISPATCH; // 0x12
        mutated.shellRadius = decision.shellRadius;
        mutated.quantizationBits = decision.suggestedQuantizationBits;
      }
    }

    return mutated;
  }
}
