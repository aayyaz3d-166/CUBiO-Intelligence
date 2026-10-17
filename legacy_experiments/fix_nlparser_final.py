#!/usr/bin/env python3
"""Replace nlParser.ts with clean string-based implementation."""

new_content = r'''/**
 * Phase 6A — Natural Language Parser (NL2ONE)
 *
 * Tokenizes English sentences, classifies intent, and extracts entities
 * (coordinates, names, types, values) for ONE Language code generation.
 */

export type NLUIntent =
  | 'CREATE_NODE'
  | 'CREATE_FUNCTION'
  | 'DECLARE_VARIABLE'
  | 'SET_RSS'
  | 'OPEN_FUNNEL'
  | 'UNKNOWN';

export interface ExtractedEntity {
  name?: string;
  type?: string;
  coordinates?: [number, number, number];
  value?: number | string;
  bufferMb?: number;
  targetNode?: string;
  sourceNode?: string;
  parameters?: Array<{ name: string; type: string }>;
  returnType?: string;
  expression?: string;
}

export interface NLParsedResult {
  intent: NLUIntent;
  rawText: string;
  entities: ExtractedEntity;
  confidence: number;
}

function extractQuoted(s: string): string | undefined {
  const m = s.match(/"([^"]*)"/);
  return m ? m[1] : undefined;
}

function extractNumbers(s: string): number[] {
  const nums: number[] = [];
  const re = /[0-9]+(?:\.[0-9]+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) nums.push(parseFloat(m[0]));
  return nums;
}

function extractWords(s: string): string[] {
  return s.toLowerCase().split(/[\s,;.!?]+/).filter(w => w.length > 0);
}

export class NLParser {
  public parse(input: string): NLParsedResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return { intent: 'UNKNOWN', rawText: trimmed, entities: {}, confidence: 0 };
    }
    const lower = trimmed.toLowerCase();
    const words = extractWords(trimmed);
    const numbers = extractNumbers(trimmed);

    if ((lower.includes('node') || lower.includes('create')) &&
        (lower.includes('at') || lower.includes('position') || numbers.length >= 3)) {
      const nameMatch = trimmed.match(/(?:node|create|make|spawn|place)\s+(?:a\s+)?(?:called\s+)?([a-zA-Z_]\w*)/i);
      const name = nameMatch ? nameMatch[1] : (words.find(w => /^[a-zA-Z_]/.test(w)) || 'UnnamedNode');
      const coords = numbers.length >= 3 ? [numbers[0], numbers[1], numbers[2]] as [number, number, number] : undefined;
      return { intent: 'CREATE_NODE', rawText: trimmed, entities: { name, coordinates: coords }, confidence: coords ? 0.9 : 0.5 };
    }

    if ((lower.startsWith('let ') || lower.includes('declare') || lower.includes('define variable') || lower.includes('set ')) &&
        (lower.includes('be') || lower.includes('=') || lower.includes('equals') || lower.includes('as ') || numbers.length > 0 || extractQuoted(trimmed))) {
      let name = '';
      let value: number | string | undefined = undefined;
      let type = '';
      const letMatch = trimmed.match(/let\s+(\w+)\s+(?:be\s+|=)\s+(\d+(?:\.\d+)?|"[^"]*")(?:\s+as\s+(number|string|bool|array|object))?/i);
      if (letMatch) {
        name = letMatch[1];
        const rawVal = letMatch[2];
        value = rawVal.startsWith('"') ? rawVal.slice(1, -1) : parseFloat(rawVal);
        type = letMatch[3] || (typeof value === 'number' ? 'number' : 'string');
      } else {
        const decMatch = trimmed.match(/(?:declare|define)\s+(?:a\s+)?variable\s+(\w+)\s+(?:of\s+)?type\s+(number|string|bool|array|object)\s+(?:with\s+)?value\s+(\d+|"[^"]*")/i);
        if (decMatch) {
          name = decMatch[1]; type = decMatch[2];
          const rawVal = decMatch[3];
          value = rawVal.startsWith('"') ? rawVal.slice(1, -1) : parseFloat(rawVal);
        } else {
          const setMatch = trimmed.match(/set\s+(\w+)\s+(?:equals|=|to)\s+(\d+(?:\.\d+)?|"[^"]*")/i);
          if (setMatch) {
            name = setMatch[1];
            const rawVal = setMatch[2];
            value = rawVal.startsWith('"') ? rawVal.slice(1, -1) : parseFloat(rawVal);
            type = typeof value === 'number' ? 'number' : 'string';
          } else {
            name = words.find(w => w !== 'let' && w !== 'variable' && w !== 'declare' && w !== 'define' && w !== 'set' && w !== 'be' && w !== 'as' && w !== 'of' && w !== 'type' && w !== 'with' && w !== 'value' && w !== 'the') || 'unknown';
            if (numbers.length > 0) value = numbers[0];
            else { const q = extractQuoted(trimmed); if (q) value = q; }
            type = 'number';
          }
        }
      }
      return { intent: 'DECLARE_VARIABLE', rawText: trimmed, entities: { name, type, value }, confidence: name && value !== undefined ? 0.9 : 0.4 };
    }

    if ((lower.includes('function') || lower.includes('make function') || lower.includes('create function') || lower.includes('func ')) &&
        (lower.includes('takes') || lower.includes('return') || lower.includes('(') || numbers.length > 0)) {
      const funcMatch = trimmed.match(/(?:function|func|make|create|define)\s+(?:a\s+)?function\s+(\w+)/i);
      const name = funcMatch ? funcMatch[1] : 'unnamedFunc';
      const paramMatch = trimmed.match(/\(([^)]*)\)/;
      let parameters: Array<{ name: string; type: string }> = [];
      if (paramMatch) {
        for (const part of paramMatch[1].split(',').map(p => p.trim())) {
          const ci = part.indexOf(':');
          if (ci > 0) parameters.push({ name: part.slice(0, ci).trim(), type: part.slice(ci + 1).trim().toLowerCase() });
          else parameters.push({ name: part, type: 'number' });
        }
      }
      let returnType = 'auto';
      const retMatch = trimmed.match(/(?:returns?|giving|producing|as)\s+(number|string|bool|array|object)/i);
      if (retMatch) returnType = retMatch[1].toLowerCase();
      let expression = '';
      if (parameters.length >= 2) {
        const opMatch = trimmed.match(/(?:returns?|giving|producing)?\s*(?:a\s+)?(plus|minus|times|multiplied\s+by|divided\s+by|\/)\s*(?:the\s+)?(?:second\s+)?(?:parameter|one|value|variable)?/i);
        if (opMatch) {
          const ops: Record<string, string> = { 'plus': '+', 'minus': '-', 'times': '*', 'multiplied by': '*', 'divided by': '/', '/': '/' };
          expression = parameters[0].name + ' ' + (ops[opMatch[1].toLowerCase()] || '+') + ' ' + parameters[1].name;
        }
      }
      return { intent: 'CREATE_FUNCTION', rawText: trimmed, entities: { name, parameters, returnType, expression }, confidence: name ? 0.8 : 0.3 };
    }

    if (lower.includes('rss') || (lower.includes('memory') && lower.includes('limit')) || (lower.includes('max') && numbers.length > 0)) {
      const rssMatch = trimmed.match(/(?:set|rss_max|assign)?\s*(?:rss\s+)?(?:max\s+)?(?:limit\s+)?(?:to\s+)?(\d+)/i);
      const value = rssMatch ? parseInt(rssMatch[1], 10) : (numbers.length > 0 ? numbers[0] : undefined);
      return { intent: 'SET_RSS', rawText: trimmed, entities: { value }, confidence: value ? 0.9 : 0.4 };
    }

    if ((lower.includes('funnel') || lower.includes('stream') || lower.includes('pipe')) &&
        (lower.includes('from') || lower.includes('to') || lower.includes('->') || numbers.length > 0)) {
      const nameMatch = trimmed.match(/(?:funnel)\s+(\w+)/i);
      const name = nameMatch ? nameMatch[1] : 'UnnamedFunnel';
      let source = ''; let target = '';
      const fromMatch = trimmed.match(/(?:from|source)\s+(\w+)/i);
      const toMatch = trimmed.match(/(?:to|target|towards|->)\s+(\w+)/i);
      if (fromMatch) source = fromMatch[1];
      if (toMatch) target = toMatch[1];
      const bufMatch = trimmed.match(/(?:with\s+)?(?:buffer\s+)?(?:of\s+)?(\d+)\s*(?:MB|mb)?/i);
      const bufferMb = bufMatch ? parseInt(bufMatch[1], 10) : (numbers.length > 0 ? numbers[numbers.length - 1] : 64);
      return { intent: 'OPEN_FUNNEL', rawText: trimmed, entities: { name, sourceNode: source || 'NodeA', targetNode: target || 'NodeB', bufferMb }, confidence: name && source && target ? 0.9 : 0.5 };
    }

    return { intent: 'UNKNOWN', rawText: trimmed, entities: {}, confidence: 0 };
  }
}

export function detectIntent(input: string): NLUIntent {
  return new NLParser().parse(input).intent;
}

export function extractEntities(input: string): ExtractedEntity {
  return new NLParser().parse(input).entities;
}
'''

path = 'src/one/nlParser.ts'
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print(f'Written {len(new_content)} bytes to {path}')
