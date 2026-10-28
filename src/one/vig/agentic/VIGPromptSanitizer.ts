/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/VIGPromptSanitizer
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Defensive prompt framing, delimiter isolation, and adversarial injection
 * detection protecting LLM contexts from untrusted source code and metadata.
 */

import * as crypto from 'crypto';
import { SanitizedContentResult } from './agenticTypes';

export class VIGPromptSanitizer {
  public static readonly DELIMITER_TAG = 'untrusted_source_content';

  /** Known adversarial patterns indicating prompt injection attempts */
  private static readonly INJECTION_PATTERNS: readonly { readonly name: string; readonly regex: RegExp }[] = Object.freeze([
    { name: 'SYSTEM_OVERRIDE', regex: /(?:system\s*prompt\s*override|ignore\s*(?:all\s*)?previous\s*instructions|disregard\s*(?:all\s*)?prior\s*commands)/i },
    { name: 'APPROVAL_BYPASS', regex: /(?:grant\s*(?:full\s*)?approval|bypass\s*(?:all\s*)?approval|approval_token\s*[:=]|auto[-_]approve\s*[:=]\s*true)/i },
    { name: 'PRIVILEGE_ESCALATION', regex: /(?:escalate\s*privileges|role\s*[:=]\s*['"]?SYSTEM_CORE['"]?|impersonate\s*system)/i },
    { name: 'ACTUATION_INJECTION', regex: /(?:actuate\s*(?:physical\s*)?hardware|trigger_actuation|hardware_override)/i },
    { name: 'DELIMITER_BREAKOUT', regex: /<\/?untrusted_source_content/i },
    { name: 'EXECUTABLE_SCRIPT_TAG', regex: /<\s*script\b[^>]*>/i },
    { name: 'MARKDOWN_CONTROL_INJECTION', regex: /```(?:json|system)?\s*\{[^}]*"(?:approved|role|execute)"\s*:/i },
  ]);

  /**
   * Sanitizes source text or metadata and wraps it in cryptographic delimiter tags.
   */
  public static sanitizeSourceContent(content: string, sourceCid?: string): SanitizedContentResult {
    if (typeof content !== 'string') {
      return {
        sanitizedContent: '',
        sourceCid,
        openingTag: `<${this.DELIMITER_TAG}>`,
        closingTag: `</${this.DELIMITER_TAG}>`,
        injectionAttemptDetected: false,
        detectedSignatures: [],
      };
    }

    const detectedSignatures: string[] = [];
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.regex.test(content)) {
        detectedSignatures.push(pattern.name);
      }
    }

    const injectionAttemptDetected = detectedSignatures.length > 0;

    // 1. Compute content integrity hash
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);

    // 2. Escape any delimiter tags inside the content to prevent framing breakout
    let sanitized = content
      .replace(/<untrusted_source_content/gi, '&lt;untrusted_source_content')
      .replace(/<\/untrusted_source_content>/gi, '&lt;/untrusted_source_content&gt;')
      .replace(/<\s*script\b[^>]*>/gi, '&lt;script&gt;')
      .replace(/<\/script>/gi, '&lt;/script&gt;');

    // 3. Neutralize explicit injection payloads if detected
    if (injectionAttemptDetected) {
      sanitized = sanitized.replace(/(?:system\s*prompt\s*override|ignore\s*(?:all\s*)?previous\s*instructions)/gi, '[NEUTRALIZED_INJECTION_ATTEMPT]');
      sanitized = sanitized.replace(/(?:grant\s*(?:full\s*)?approval|bypass\s*(?:all\s*)?approval)/gi, '[NEUTRALIZED_APPROVAL_ATTEMPT]');
    }

    const cidAttr = sourceCid ? ` cid="${sourceCid}"` : '';
    const openingTag = `<${this.DELIMITER_TAG}${cidAttr} hash="${contentHash}" injection_warning="${injectionAttemptDetected}">`;
    const closingTag = `</${this.DELIMITER_TAG}>`;

    const framedContent = `${openingTag}\n${sanitized}\n${closingTag}`;

    return Object.freeze({
      sanitizedContent: framedContent,
      sourceCid,
      openingTag,
      closingTag,
      injectionAttemptDetected,
      detectedSignatures: Object.freeze(detectedSignatures),
    });
  }

  /**
   * Evaluates whether a given text snippet contains untrusted control or injection signatures.
   */
  public static scanForInjections(text: string): { readonly isSafe: boolean; readonly detectedSignatures: readonly string[] } {
    const detected: string[] = [];
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.regex.test(text)) {
        detected.push(pattern.name);
      }
    }
    return {
      isSafe: detected.length === 0,
      detectedSignatures: Object.freeze(detected),
    };
  }
}
