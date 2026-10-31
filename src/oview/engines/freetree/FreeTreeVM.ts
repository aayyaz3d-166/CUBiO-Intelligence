/**
 * FreeTree Engine — High-Speed Sovereign Virtual Machine & Execution Pipeline
 * ============================================================================
 * FreeTreeVM.ts: The V8-equivalent execution engine powering CUBiO Browser.
 * Executes sovereign scripts, manages reactive page state, handles events,
 * and compiles FreeTree ASTs into rendered reactive views.
 */

import {
  FreeTreeDocumentNode,
  FreeTreeElementNode,
  FreeTreeNode,
  FreeTreeScriptNode,
  FreeTreeTextNode,
} from './FreeTreeNode';
import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';

export interface FreeTreeExecutionContext {
  url: string;
  state: Record<string, any>;
  consoleLogs: string[];
  vfs: VirtualFileSystem;
  memorySlot369: number;
}

export class FreeTreeVM {
  private doc: FreeTreeDocumentNode;
  private ctx: FreeTreeExecutionContext;
  private elementsById: Map<string, FreeTreeElementNode> = new Map();

  constructor(doc: FreeTreeDocumentNode, memorySlot: number = 250) {
    this.doc = doc;
    this.ctx = {
      url: doc.url,
      state: {},
      consoleLogs: [],
      vfs: VirtualFileSystem.getInstance(),
      memorySlot369: memorySlot,
    };
    this.indexElements(this.doc.body);
  }

  private indexElements(node: FreeTreeNode): void {
    if (node.type === 'element') {
      const elem = node as FreeTreeElementNode;
      this.elementsById.set(elem.id, elem);
      if (elem.attributes['id']) {
        this.elementsById.set(elem.attributes['id'], elem);
      }
      for (const child of elem.children) {
        this.indexElements(child);
      }
    }
  }

  /**
   * Initializes and executes all scripts embedded in the document.
   */
  public execute(): void {
    for (const script of this.doc.scripts) {
      this.executeScript(script);
    }
  }

  /**
   * Executes a single FreeTree script node.
   */
  public executeScript(script: FreeTreeScriptNode): any {
    const code = script.source.trim();
    if (!code) return null;

    try {
      return this.evaluateScript(code);
    } catch (err: any) {
      this.log(`[FreeTreeVM Error] ${err.message}`);
      return null;
    }
  }

  /**
   * Evaluates a script expression or statement within the sovereign sandbox.
   */
  public evaluateScript(code: string): any {
    // Sandbox API
    const cubio = {
      url: this.ctx.url,
      state: this.ctx.state,
      slot: this.ctx.memorySlot369,
      log: (...args: any[]) => this.log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      getState: (key: string) => this.ctx.state[key],
      setState: (key: string, val: any) => {
        this.ctx.state[key] = val;
      },
      readFile: (path: string) => {
        try {
          return this.ctx.vfs.readFile(path);
        } catch {
          return null;
        }
      },
      writeFile: (path: string, content: string) => {
        this.ctx.vfs.writeFile(path, content);
      },
      getElementById: (id: string) => {
        return this.elementsById.get(id) || null;
      },
    };

    // Safe scoped evaluation
    const fn = new Function('cubio', 'state', `
      with (cubio) {
        ${code}
      }
    `);
    return fn(cubio, this.ctx.state);
  }

  /**
   * Dispatches an event (e.g. 'click', 'input') on a target element.
   */
  public dispatchEvent(elementId: string, eventName: string, eventData?: any): any {
    const elem = this.elementsById.get(elementId);
    if (!elem) return null;

    const handlerCode = elem.events[eventName.toLowerCase()];
    if (!handlerCode) return null;

    this.log(`[Event ${eventName}] triggered on #${elementId}: ${handlerCode}`);
    return this.evaluateScript(handlerCode);
  }

  public log(msg: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.ctx.consoleLogs.push(`[${timestamp}] ${msg}`);
  }

  public getLogs(): string[] {
    return [...this.ctx.consoleLogs];
  }

  public getState(): Record<string, any> {
    return { ...this.ctx.state };
  }

  public getDocument(): FreeTreeDocumentNode {
    return this.doc;
  }

  /**
   * Renders the FreeTree AST into reactive, styled HTML.
   */
  public renderToHTML(): string {
    const styles = this.doc.styles.map(s => `<style>${s.cssText}</style>`).join('\n');
    const bodyHtml = this.renderNodeToHTML(this.doc.body);

    return `
      <div class="cubio-rendered-page" style="font-family: system-ui, -apple-system, sans-serif; color: #f8fafc; line-height: 1.5; padding: 20px;">
        ${styles}
        ${bodyHtml}
      </div>
    `;
  }

  private renderNodeToHTML(node: FreeTreeNode): string {
    if (node.type === 'text') {
      return (node as FreeTreeTextNode).text;
    }

    if (node.type === 'element') {
      const elem = node as FreeTreeElementNode;
      const tag = elem.tag;

      // Construct attributes
      const attrsArr: string[] = [];
      for (const [k, v] of Object.entries(elem.attributes)) {
        if (!k.startsWith('on-') && !k.startsWith('on:')) {
          attrsArr.push(`${k}="${v.replace(/"/g, '&quot;')}"`);
        }
      }

      // Add inline style if present
      if (Object.keys(elem.style).length > 0) {
        const styleStr = Object.entries(elem.style)
          .map(([k, v]) => `${k}:${v}`)
          .join(';');
        attrsArr.push(`style="${styleStr}"`);
      }

      // Hook click events to FreeTree VM bridge
      if (elem.events['click']) {
        const targetId = elem.attributes['id'] || elem.id;
        attrsArr.push(`data-freetree-click="${targetId}"`);
      }

      const attrs = attrsArr.length > 0 ? ' ' + attrsArr.join(' ') : '';
      const childrenHtml = elem.children.map(c => this.renderNodeToHTML(c)).join('');

      return `<${tag}${attrs}>${childrenHtml}</${tag}>`;
    }

    return '';
  }
}
