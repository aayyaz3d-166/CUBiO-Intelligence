import { Token, TokenType } from '../oneLexer';
import { OneParser } from '../oneParser';
import { ComputationalParser } from '../computational/ComputationalParser';
import { DeclarativeASTAdapter } from '../ast/DeclarativeASTAdapter';
import { UnifiedProgramNode } from '../ast/UnifiedAST';

export enum GrammarKind {
  DECLARATIVE = 'DECLARATIVE',
  COMPUTATIONAL = 'COMPUTATIONAL',
  AMBIGUOUS = 'AMBIGUOUS',
}

export interface RoutingDecision {
  grammar: GrammarKind;
  reason: string;
  firstSignificantToken?: Token;
}

export class GrammarRouter {
  private static DECLARATIVE_KEYWORDS = new Set<TokenType>([
    TokenType.KEYWORD_NODE,
    TokenType.KEYWORD_FUNNEL,
    TokenType.KEYWORD_CHANNEL,
    TokenType.KEYWORD_RSS_MAX,
    TokenType.KEYWORD_ASSERT_RSS,
    TokenType.KEYWORD_ACTUATION_LOCK,
    TokenType.KEYWORD_SLICE,
    TokenType.KEYWORD_SEAL,
    TokenType.KEYWORD_SPACE,
    TokenType.KEYWORD_GRID777,
    TokenType.KEYWORD_MEMVIEW,
  ]);

  private static COMPUTATIONAL_KEYWORDS = new Set<TokenType>([
    TokenType.KEYWORD_LET,
    TokenType.KEYWORD_CONST,
    TokenType.KEYWORD_FUNCTION,
    TokenType.KEYWORD_FN,
    TokenType.KEYWORD_IF,
    TokenType.KEYWORD_ELSE,
    TokenType.KEYWORD_WHILE,
    TokenType.KEYWORD_FOR,
    TokenType.KEYWORD_RETURN,
    TokenType.KEYWORD_PRINT,
    TokenType.KEYWORD_IMPORT,
    TokenType.KEYWORD_MODULE,
    TokenType.KEYWORD_STRUCT,
    TokenType.KEYWORD_CLASS,
    TokenType.KEYWORD_NATIVE,
  ]);

  /**
   * Deterministically inspects the token stream to decide the grammar domain.
   */
  public static route(tokens: Token[]): RoutingDecision {
    for (const token of tokens) {
      if (token.type === TokenType.EOF) {
        break;
      }

      // Check declarative keywords
      if (GrammarRouter.DECLARATIVE_KEYWORDS.has(token.type)) {
        return {
          grammar: GrammarKind.DECLARATIVE,
          reason: `Dispatched to Declarative Parser due to leading declarative token '${token.value}' (${token.type}) at line ${token.line}, col ${token.column}`,
          firstSignificantToken: token,
        };
      }

      // Check computational keywords
      if (GrammarRouter.COMPUTATIONAL_KEYWORDS.has(token.type)) {
        return {
          grammar: GrammarKind.COMPUTATIONAL,
          reason: `Dispatched to Computational Parser due to leading computational token '${token.value}' (${token.type}) at line ${token.line}, col ${token.column}`,
          firstSignificantToken: token,
        };
      }

      // Check for standalone expressions or identifier starts
      if (
        token.type === TokenType.IDENTIFIER ||
        token.type === TokenType.NUMBER_LITERAL ||
        token.type === TokenType.STRING_LITERAL ||
        token.type === TokenType.LBRACE ||
        token.type === TokenType.LBRACKET
      ) {
        return {
          grammar: GrammarKind.COMPUTATIONAL,
          reason: `Dispatched to Computational Parser due to leading expression/identifier token '${token.value}' at line ${token.line}, col ${token.column}`,
          firstSignificantToken: token,
        };
      }
    }

    // If completely empty or only whitespace/comments/EOF
    return {
      grammar: GrammarKind.COMPUTATIONAL,
      reason: 'Empty token stream defaulted to Computational grammar',
    };
  }

  /**
   * Routes and parses the token stream into a UnifiedProgramNode.
   */
  public static parse(tokens: Token[]): { ast: UnifiedProgramNode; decision: RoutingDecision } {
    const decision = GrammarRouter.route(tokens);

    if (decision.grammar === GrammarKind.DECLARATIVE) {
      const declarativeParser = new OneParser(tokens);
      const declarativeAST = declarativeParser.parse();
      const unifiedAST = DeclarativeASTAdapter.adapt(declarativeAST);
      return { ast: unifiedAST, decision };
    } else {
      const computationalParser = new ComputationalParser(tokens);
      const unifiedAST = computationalParser.parse();
      return { ast: unifiedAST, decision };
    }
  }
}
