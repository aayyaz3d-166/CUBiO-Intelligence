export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export function createSourceSpan(
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number
): SourceSpan {
  return {
    start: { line: startLine, column: startCol },
    end: { line: endLine, column: endCol },
  };
}
