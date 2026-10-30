/**
 * OLTO Frontend Subsystem — Self-Healing Compiler & Auto-Repair Loop
 * =================================================================
 * Analyzes OLTO compiler diagnostics (E9001–E9005, syntax mismatches)
 * and automatically rewrites code to fix security violations and syntax errors.
 */

import { OltoCompiler, OltoDiagnostic } from '../compiler/index';

export interface RepairResult {
  repaired: boolean;
  success: boolean;
  source: string;
  fixedIssues: string[];
  remainingDiagnostics: OltoDiagnostic[];
}

export class OltoAutoRepair {
  /**
   * Evaluates source code and runs automatic repair passes until the code compiles
   * or maximum repair iterations are reached.
   */
  public static repair(source: string, maxIterations = 3): RepairResult {
    let currentSource = source;
    const fixedIssues: string[] = [];

    for (let iter = 0; iter < maxIterations; iter++) {
      const compileRes = OltoCompiler.compile(currentSource);
      if (compileRes.success) {
        return {
          repaired: fixedIssues.length > 0,
          success: true,
          source: currentSource,
          fixedIssues,
          remainingDiagnostics: [],
        };
      }

      let modified = false;

      for (const diag of compileRes.diagnostics) {
        // 1. Repair E9001: ClientSecretExposureViolation
        if (diag.code === 'E9001') {
          const secretRegex = /state\s+([A-Za-z0-9_]*(SECRET|KEY|PASSWORD|TOKEN|AUTH)[A-Za-z0-9_]*)\s*:\s*[a-zA-Z_]+\s*=\s*("[^"]*"|'[^']*');?/gi;
          if (secretRegex.test(currentSource)) {
            currentSource = currentSource.replace(
              secretRegex,
              '// [AUTO-REPAIR E9001] Client secret removed for security compliance\n  state clientAuthToken: string = "PUBLIC_SESSION";'
            );
            fixedIssues.push('E9001: Removed sensitive client-side secret exposure.');
            modified = true;
          }
        }

        // 2. Repair E9002: UnrecognizedComponentError
        if (diag.code === 'E9002') {
          const replacements: Record<string, string> = {
            Box: 'Container',
            div: 'Container',
            Heading: 'Text',
            Typography: 'Text',
            p: 'Text',
            span: 'Text',
            h1: 'Text',
            h2: 'Text',
            h3: 'Text',
            Btn: 'Button',
            button: 'Button',
            Submit: 'Button',
            TextField: 'Input',
            input: 'Input',
            Dialog: 'Modal',
            Popup: 'Modal',
            UnknownWidget: 'Container',
          };

          for (const [badTag, goodTag] of Object.entries(replacements)) {
            const funcCallRegex = new RegExp(`\\b${badTag}\\s*\\(`, 'g');
            if (funcCallRegex.test(currentSource)) {
              currentSource = currentSource.replace(funcCallRegex, `${goodTag}(`);
              fixedIssues.push(`E9002: Replaced unrecognized component ${badTag} with ${goodTag}.`);
              modified = true;
            }

            const openTagRegex = new RegExp(`<${badTag}(\\s|>|/)`, 'g');
            const closeTagRegex = new RegExp(`</${badTag}>`, 'g');
            if (openTagRegex.test(currentSource)) {
              currentSource = currentSource.replace(openTagRegex, `<${goodTag}$1`);
              currentSource = currentSource.replace(closeTagRegex, `</${goodTag}>`);
              fixedIssues.push(`E9002: Replaced unrecognized component <${badTag}> with <${goodTag}>.`);
              modified = true;
            }
          }
        }

        // 3. Repair E9003: InvalidStateMutationError (mutating computed property)
        if (diag.code === 'E9003') {
          // Replace assignment to computed with state update
          const compMutRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(\+=|-=|=)\s*([^;]+);/g;
          // If we detect mutated computed property in message
          const match = diag.message.match(/'([^']+)'/);
          if (match) {
            const compName = match[1];
            const targetRegex = new RegExp(`${compName}\\s*(\\+=|-=|=)\\s*[^;]+;`, 'g');
            if (targetRegex.test(currentSource)) {
              currentSource = currentSource.replace(targetRegex, `// [AUTO-REPAIR E9003] Removed mutation on read-only computed '${compName}'`);
              fixedIssues.push(`E9003: Removed illegal mutation on computed property '${compName}'.`);
              modified = true;
            }
          }
        }
      }

      // 4. Bracket / Brace balancing
      const openBraces = (currentSource.match(/\{/g) || []).length;
      const closeBraces = (currentSource.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        const missing = openBraces - closeBraces;
        currentSource = currentSource.trimEnd() + '\n' + '}'.repeat(missing) + '\n';
        fixedIssues.push(`Syntax: Appended ${missing} missing closing brace(s).`);
        modified = true;
      }

      if (!modified) {
        // No further automatic heuristics available
        break;
      }
    }

    const finalCheck = OltoCompiler.compile(currentSource);
    return {
      repaired: fixedIssues.length > 0,
      success: finalCheck.success,
      source: currentSource,
      fixedIssues,
      remainingDiagnostics: finalCheck.diagnostics,
    };
  }
}
