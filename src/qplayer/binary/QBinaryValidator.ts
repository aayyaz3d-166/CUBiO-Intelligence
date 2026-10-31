/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QBinaryValidator.ts: Fail-Closed Binary & Invariant Validation for OBI Streams
 */

import {
  OBI_HEADER_SIZE,
  OBI_FLAG_ACTUATION_LOCKED,
  OBIInstruction,
  OBICategory,
  OBIOperandMode,
  OBIProgram,
} from '../spec/OBISpec';
import { QBinaryDecoder } from './QBinaryDecoder';

export interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  error?: string;
}

export class QBinaryValidator {
  /**
   * Performs complete fail-closed structural, cryptographic, and invariant validation.
   */
  public static validateBuffer(buffer: Buffer): ValidationResult {
    if (buffer.length < OBI_HEADER_SIZE) {
      return {
        valid: false,
        errorCode: 'E8001',
        error: `Buffer too small for OBI header (${buffer.length} < ${OBI_HEADER_SIZE})`,
      };
    }

    try {
      const program = QBinaryDecoder.decode(buffer);
      return this.validateProgram(program);
    } catch (err: any) {
      return {
        valid: false,
        errorCode: err.code || 'E8002',
        error: err.message || String(err),
      };
    }
  }

  /**
   * Validates internal consistency of decoded OBIProgram.
   */
  public static validateProgram(program: OBIProgram): ValidationResult {
    // 1. Mandatory Invariant: ACTUATION_LOCK flag must be set
    if (!(program.header.flags & OBI_FLAG_ACTUATION_LOCKED)) {
      return {
        valid: false,
        errorCode: 'E8005',
        error: 'Safety Invariant Violation: OBI binary lacks mandatory ACTUATION_LOCK flag',
      };
    }

    // 2. Validate Instructions
    for (let i = 0; i < program.instructions.length; i++) {
      const instr = program.instructions[i];

      // Category bounds [0..7]
      if (instr.category < 0 || instr.category > 7) {
        return {
          valid: false,
          errorCode: 'E8006',
          error: `Instruction at PC ${i} has invalid category ${instr.category}`,
        };
      }

      // Address369 spatial boundary check [0..368]
      if (instr.category === OBICategory.SPATIAL369 || instr.mode === OBIOperandMode.SPATIAL_ADDR) {
        if (instr.harmonicDest < 0 || instr.harmonicDest > 368) {
          return {
            valid: false,
            errorCode: 'E8005',
            error: `Address369 bounds violation at PC ${i}: address ${instr.harmonicDest} exceeds maximum 368`,
          };
        }
      }

      // Constant pool bounds check
      if (instr.mode === OBIOperandMode.REG_CONSTPOOL) {
        if (instr.srcB >= program.constants.length) {
          return {
            valid: false,
            errorCode: 'E8007',
            error: `Constant pool index out-of-bounds at PC ${i}: index ${instr.srcB} >= pool size ${program.constants.length}`,
          };
        }
      }
    }

    return { valid: true };
  }
}
