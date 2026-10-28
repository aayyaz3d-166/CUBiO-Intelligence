/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QGraphLowering.ts: Transforms AST into QGraph and Emits One Binary Instructions
 */

import {
  UnifiedProgramNode,
  UnifiedStatementNode,
  VariableDeclarationNode,
  PrintStatementNode,
  InputStatementNode,
  BinaryExpressionNode,
  LiteralNode,
  IdentifierNode,
  ExpressionNode,
} from '../../one/ast/UnifiedAST';
import { QComputationalGraph, QNode } from './QGraph';
import { QGraphOptimizer } from './QGraphOptimizer';
import {
  OBICategory,
  OBIOpcodeArithmetic,
  OBIOpcodeIO,
  OBIOpcodeControl,
  OBIOpcodeMemory,
  OBIOperandMode,
  OBIInstruction,
  OBIConstant,
  OBIProgram,
  OBIHeader,
  OBI_MAGIC,
} from '../spec/OBISpec';

export class QGraphLowering {
  /**
   * Constructs an optimized QComputationalGraph from a UnifiedProgramNode AST.
   */
  public static buildGraphFromAST(ast: UnifiedProgramNode): QComputationalGraph {
    const graph = new QComputationalGraph();
    const env = new Map<string, number>(); // variable name -> producing node ID

    for (const stmt of ast.body) {
      this.lowerStatement(stmt, graph, env);
    }

    // Append HALT node
    graph.addNode('HALT', [], undefined, undefined, true);

    return QGraphOptimizer.optimize(graph);
  }

  private static lowerStatement(
    stmt: UnifiedStatementNode,
    graph: QComputationalGraph,
    env: Map<string, number>
  ): void {
    switch (stmt.kind) {
      case 'InputStatement': {
        const inp = stmt as InputStatementNode;
        const node = graph.addNode('INPUT', [], undefined, inp.target, true);
        env.set(inp.target, node.id);
        break;
      }

      case 'VariableDeclaration': {
        const decl = stmt as VariableDeclarationNode;
        const initExpr = decl.initializer || (decl as any).init;
        if (initExpr) {
          const valNodeId = this.lowerExpression(initExpr, graph, env);
          graph.addNode('STORE_VAR', [valNodeId], undefined, decl.identifier, true);
          env.set(decl.identifier, valNodeId);
        }
        break;
      }

      case 'PrintStatement': {
        const printStmt = stmt as PrintStatementNode;
        const valNodeId = this.lowerExpression(printStmt.expression, graph, env);
        graph.addNode('OUTPUT', [valNodeId], undefined, undefined, true);
        break;
      }

      default:
        break;
    }
  }

  private static lowerExpression(
    expr: ExpressionNode,
    graph: QComputationalGraph,
    env: Map<string, number>
  ): number {
    switch (expr.kind) {
      case 'Literal': {
        const lit = expr as LiteralNode;
        const node = graph.addNode('CONST', [], lit.value);
        return node.id;
      }

      case 'Identifier': {
        const id = expr as IdentifierNode;
        if (env.has(id.name)) {
          return env.get(id.name)!;
        }
        const loadNode = graph.addNode('LOAD_VAR', [], undefined, id.name);
        return loadNode.id;
      }

      case 'BinaryExpression': {
        const bin = expr as BinaryExpressionNode;
        const leftId = this.lowerExpression(bin.left, graph, env);
        const rightId = this.lowerExpression(bin.right, graph, env);

        let kind: any = 'ADD';
        switch (bin.operator) {
          case '+': kind = 'ADD'; break;
          case '-': kind = 'SUB'; break;
          case '*': kind = 'MUL'; break;
          case '/': kind = 'DIV'; break;
          case '%': kind = 'MOD'; break;
          case '==': kind = 'EQ'; break;
          case '<': kind = 'LT'; break;
          case '>': kind = 'GT'; break;
          default: kind = 'ADD'; break;
        }

        const binNode = graph.addNode(kind, [leftId, rightId]);
        return binNode.id;
      }

      default:
        const fallbackNode = graph.addNode('CONST', [], 0);
        return fallbackNode.id;
    }
  }

  /**
   * Lowers an optimized QComputationalGraph into an OBIProgram ready for encoding.
   */
  public static lowerGraphToOBI(graph: QComputationalGraph): OBIProgram {
    const sortedNodes = graph.topologicalSort();
    const instructions: OBIInstruction[] = [];
    const constants: OBIConstant[] = [];

    const getConstIndex = (val: OBIConstant): number => {
      let idx = constants.indexOf(val);
      if (idx === -1) {
        idx = constants.length;
        constants.push(val);
      }
      return idx;
    };

    for (const node of sortedNodes) {
      const destReg = node.register ?? 0;

      switch (node.kind) {
        case 'CONST': {
          const constIdx = getConstIndex(node.value ?? 0);
          instructions.push({
            category: OBICategory.MEMORY,
            opcode: OBIOpcodeMemory.LOAD_CONST,
            harmonicDest: destReg,
            srcA: 0,
            srcB: constIdx,
            mode: OBIOperandMode.REG_CONSTPOOL,
          });
          break;
        }

        case 'INPUT': {
          instructions.push({
            category: OBICategory.IO,
            opcode: OBIOpcodeIO.INPUT,
            harmonicDest: destReg,
            srcA: 0,
            srcB: 0,
            mode: OBIOperandMode.REG_REG,
          });
          break;
        }

        case 'STORE_VAR': {
          const srcNode = graph.getNode(node.dependencies[0]);
          const srcReg = srcNode?.register ?? 0;
          const varNameIdx = getConstIndex(node.variableName ?? 'v');
          instructions.push({
            category: OBICategory.MEMORY,
            opcode: OBIOpcodeMemory.STORE_VAR,
            harmonicDest: destReg,
            srcA: srcReg,
            srcB: varNameIdx,
            mode: OBIOperandMode.REG_CONSTPOOL,
          });
          break;
        }

        case 'LOAD_VAR': {
          const varNameIdx = getConstIndex(node.variableName ?? 'v');
          instructions.push({
            category: OBICategory.MEMORY,
            opcode: OBIOpcodeMemory.LOAD_VAR,
            harmonicDest: destReg,
            srcA: 0,
            srcB: varNameIdx,
            mode: OBIOperandMode.REG_CONSTPOOL,
          });
          break;
        }

        case 'ADD':
        case 'SUB':
        case 'MUL':
        case 'DIV':
        case 'MOD':
        case 'EQ':
        case 'LT':
        case 'GT': {
          const leftNode = graph.getNode(node.dependencies[0]);
          const rightNode = graph.getNode(node.dependencies[1]);
          const srcA = leftNode?.register ?? 0;
          const srcB = rightNode?.register ?? 0;

          let op: number = OBIOpcodeArithmetic.ADD;
          switch (node.kind) {
            case 'ADD': op = OBIOpcodeArithmetic.ADD; break;
            case 'SUB': op = OBIOpcodeArithmetic.SUB; break;
            case 'MUL': op = OBIOpcodeArithmetic.MUL; break;
            case 'DIV': op = OBIOpcodeArithmetic.DIV; break;
            case 'MOD': op = OBIOpcodeArithmetic.MOD; break;
            case 'EQ':  op = OBIOpcodeArithmetic.EQ; break;
            case 'LT':  op = OBIOpcodeArithmetic.LT; break;
            case 'GT':  op = OBIOpcodeArithmetic.GT; break;
          }

          instructions.push({
            category: OBICategory.ARITHMETIC,
            opcode: op,
            harmonicDest: destReg,
            srcA,
            srcB,
            mode: OBIOperandMode.REG_REG,
          });
          break;
        }

        case 'OUTPUT': {
          const srcNode = graph.getNode(node.dependencies[0]);
          const srcReg = srcNode?.register ?? 0;
          instructions.push({
            category: OBICategory.IO,
            opcode: OBIOpcodeIO.OUTPUT,
            harmonicDest: 0,
            srcA: srcReg,
            srcB: 0,
            mode: OBIOperandMode.REG_REG,
          });
          break;
        }

        case 'HALT': {
          instructions.push({
            category: OBICategory.CONTROL,
            opcode: OBIOpcodeControl.HALT,
            harmonicDest: 0,
            srcA: 0,
            srcB: 0,
            mode: OBIOperandMode.REG_REG,
          });
          break;
        }
      }
    }

    const header: OBIHeader = {
      magic: OBI_MAGIC,
      versionMajor: 1,
      versionMinor: 0,
      flags: 1, // ACTUATION_LOCKED
      instructionCount: instructions.length,
      constPoolOffset: 32 + instructions.length * 4,
      constPoolSize: 0,
      entryPC: 0,
      checksumCRC32: 0,
    };

    return {
      header,
      instructions,
      constants,
    };
  }
}
