/**
 * FreeTree Engine — High-Speed Sovereign Markup Parser
 * ============================================================================
 * FreeTreeParser.ts: Lexes and parses Sovereign Hypermedia markup (.cub, .html, .one-page)
 * into a structured, reactive FreeTree AST ready for VM evaluation and rendering.
 */

import {
  FreeTreeDocumentNode,
  FreeTreeElementNode,
  FreeTreeScriptNode,
  FreeTreeStyleNode,
  FreeTreeNode,
  createDocumentNode,
  createElementNode,
  createTextNode,
  generateNodeId,
} from './FreeTreeNode';

export class FreeTreeParser {
  /**
   * Parses raw markup into a FreeTree Document AST.
   */
  public static parse(source: string, url: string = 'cubio://page'): FreeTreeDocumentNode {
    const doc = createDocumentNode(url, 'CUBiO Sovereign Page');
    const parser = new FreeTreeParser(source, doc);
    return parser.parseDocument();
  }

  private source: string;
  private pos: number = 0;
  private len: number = 0;
  private doc: FreeTreeDocumentNode;

  constructor(source: string, doc: FreeTreeDocumentNode) {
    this.source = source || '';
    this.len = this.source.length;
    this.doc = doc;
  }

  private parseDocument(): FreeTreeDocumentNode {
    const rootNodes: FreeTreeNode[] = [];

    while (this.pos < this.len) {
      if (this.source.startsWith('<!--', this.pos)) {
        this.skipComment();
      } else if (this.source.startsWith('<!DOCTYPE', this.pos) || this.source.startsWith('<!doctype', this.pos)) {
        this.skipDocType();
      } else if (this.source.startsWith('<', this.pos)) {
        const node = this.parseTag();
        if (node) {
          if (node.type !== 'script' && node.type !== 'style') {
            rootNodes.push(node);
          }
        }
      } else {
        const textNode = this.parseText();
        if (textNode && textNode.text.trim()) {
          rootNodes.push(textNode);
        }
      }
    }

    // Filter elements into body
    const bodyElem = rootNodes.find(n => n.type === 'element' && (n as FreeTreeElementNode).tag === 'body') as FreeTreeElementNode | undefined;
    if (bodyElem) {
      this.doc.body = bodyElem;
    } else {
      this.doc.body.children = rootNodes;
    }

    return this.doc;
  }

  private skipComment(): void {
    const end = this.source.indexOf('-->', this.pos);
    if (end === -1) {
      this.pos = this.len;
    } else {
      this.pos = end + 3;
    }
  }

  private skipDocType(): void {
    const end = this.source.indexOf('>', this.pos);
    if (end === -1) {
      this.pos = this.len;
    } else {
      this.pos = end + 1;
    }
  }

  private parseText(): FreeTreeNode | null {
    const start = this.pos;
    while (this.pos < this.len && this.source[this.pos] !== '<') {
      this.pos++;
    }
    const text = this.source.slice(start, this.pos);
    if (!text) return null;
    return createTextNode(text);
  }

  private parseTag(): FreeTreeNode | null {
    if (this.source[this.pos] !== '<') return null;

    // Check if it's a closing tag
    if (this.source.startsWith('</', this.pos)) {
      const end = this.source.indexOf('>', this.pos);
      this.pos = end === -1 ? this.len : end + 1;
      return null;
    }

    this.pos++; // skip '<'
    this.skipWhitespace();

    // Read tag name
    const tagStart = this.pos;
    while (this.pos < this.len && /[a-zA-Z0-9_\-:]/.test(this.source[this.pos])) {
      this.pos++;
    }
    const rawTag = this.source.slice(tagStart, this.pos).toLowerCase();
    if (!rawTag) return null;

    // Read attributes
    const attributes: Record<string, string> = {};
    let isSelfClosing = false;

    while (this.pos < this.len) {
      this.skipWhitespace();
      if (this.pos >= this.len) break;

      if (this.source[this.pos] === '>') {
        this.pos++;
        break;
      }
      if (this.source.startsWith('/>', this.pos)) {
        isSelfClosing = true;
        this.pos += 2;
        break;
      }

      // Attribute key
      const attrKeyStart = this.pos;
      while (this.pos < this.len && /[a-zA-Z0-9_\-:@.]/.test(this.source[this.pos])) {
        this.pos++;
      }
      const attrKey = this.source.slice(attrKeyStart, this.pos);

      this.skipWhitespace();
      let attrVal = '';
      if (this.pos < this.len && this.source[this.pos] === '=') {
        this.pos++; // skip '='
        this.skipWhitespace();
        if (this.pos < this.len) {
          const quote = this.source[this.pos];
          if (quote === '"' || quote === "'") {
            this.pos++; // skip quote
            const valStart = this.pos;
            while (this.pos < this.len && this.source[this.pos] !== quote) {
              if (this.source[this.pos] === '\\' && this.pos + 1 < this.len) {
                this.pos += 2;
              } else {
                this.pos++;
              }
            }
            attrVal = this.source.slice(valStart, this.pos);
            if (this.pos < this.len && this.source[this.pos] === quote) {
              this.pos++; // skip closing quote
            }
          } else {
            // Unquoted value
            const valStart = this.pos;
            while (this.pos < this.len && !/[\s>]/.test(this.source[this.pos])) {
              this.pos++;
            }
            attrVal = this.source.slice(valStart, this.pos);
          }
        }
      } else {
        attrVal = 'true';
      }

      if (attrKey) {
        attributes[attrKey] = attrVal;
      }
    }

    // Special tag: title
    if (rawTag === 'title') {
      const content = this.readUntilCloseTag('title');
      this.doc.title = content.trim() || this.doc.title;
      return null;
    }

    // Special tag: script
    if (rawTag === 'script') {
      const scriptType = (attributes['type'] || 'cubio').toLowerCase() as 'one' | 'cubio' | 'bytecode';
      const content = this.readUntilCloseTag('script');
      const scriptNode: FreeTreeScriptNode = {
        id: generateNodeId('script'),
        type: 'script',
        scriptType: scriptType.includes('one') ? 'one' : 'cubio',
        source: content,
        parentId: null,
      };
      this.doc.scripts.push(scriptNode);
      return scriptNode;
    }

    // Special tag: style
    if (rawTag === 'style') {
      const cssText = this.readUntilCloseTag('style');
      const styleNode: FreeTreeStyleNode = {
        id: generateNodeId('style'),
        type: 'style',
        cssText,
        parsedRules: this.parseSimpleCss(cssText),
        parentId: null,
      };
      this.doc.styles.push(styleNode);
      return styleNode;
    }

    // Self closing tags
    const voidTags = ['input', 'img', 'br', 'hr', 'meta', 'link'];
    if (isSelfClosing || voidTags.includes(rawTag)) {
      return createElementNode(rawTag, attributes, [], null);
    }

    // Parse children elements until </rawTag>
    const children: FreeTreeNode[] = [];
    const closeTag = `</${rawTag}>`;

    while (this.pos < this.len) {
      if (this.source.startsWith(closeTag, this.pos)) {
        this.pos += closeTag.length;
        break;
      }

      // Check if another closing tag is reached (fault tolerance)
      if (this.source.startsWith('</', this.pos)) {
        // Could be mismatched closing tag
        const closingTagEnd = this.source.indexOf('>', this.pos);
        if (closingTagEnd !== -1) {
          const closingTagName = this.source.slice(this.pos + 2, closingTagEnd).trim().toLowerCase();
          if (closingTagName === rawTag) {
            this.pos = closingTagEnd + 1;
            break;
          }
        }
      }

      if (this.source.startsWith('<', this.pos)) {
        const child = this.parseTag();
        if (child) children.push(child);
      } else {
        const text = this.parseText();
        if (text) children.push(text);
      }
    }

    return createElementNode(rawTag, attributes, children, null);
  }

  private readUntilCloseTag(tagName: string): string {
    const closeTag = `</${tagName}>`;
    const start = this.pos;
    const end = this.source.indexOf(closeTag, this.pos);
    if (end === -1) {
      this.pos = this.len;
      return this.source.slice(start);
    }
    const content = this.source.slice(start, end);
    this.pos = end + closeTag.length;
    return content;
  }

  private parseSimpleCss(css: string): Record<string, Record<string, string>> {
    const rules: Record<string, Record<string, string>> = {};
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = cleanCss.split('}');

    for (const block of blocks) {
      const idx = block.indexOf('{');
      if (idx > 0) {
        const selector = block.slice(0, idx).trim();
        const decls = block.slice(idx + 1).trim();
        if (selector && decls) {
          rules[selector] = {};
          decls.split(';').forEach(d => {
            const cIdx = d.indexOf(':');
            if (cIdx > 0) {
              const k = d.slice(0, cIdx).trim();
              const v = d.slice(cIdx + 1).trim();
              if (k && v) rules[selector][k] = v;
            }
          });
        }
      }
    }
    return rules;
  }

  private skipWhitespace(): void {
    while (this.pos < this.len && /\s/.test(this.source[this.pos])) {
      this.pos++;
    }
  }
}
