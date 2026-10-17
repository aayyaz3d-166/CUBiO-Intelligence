import re

content = open('src/one/nlParser.ts', 'r').read()

# Check if file has the corrupt INTENT_PATTERNS section
if 'INTENT_PATTERNS' in content:
    # Find the start and end of the corrupt section
    start_marker = '// \u2500\u2500\u2500 Intent Patterns'
    end_marker = '// \u2500\u2500\u2500 NL Parser'
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx >= 0 and end_idx >= 0:
        # Build clean replacement
        clean_section = '''// \u2500\u2500\u2500 Helpers \u2500\u2500\u2500

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

'''
        # Replace from start_marker to end_marker (exclusive)
        new_content = content[:start_idx] + clean_section + content[end_idx:]
        open('src/one/nlParser.ts', 'w').write(new_content)
        print('Fixed nlParser.ts - removed corrupt INTENT_PATTERNS')
    else:
        print(f'Could not find markers: start={start_idx}, end={end_idx}')
else:
    print('No INTENT_PATTERNS found - file may already be clean')
