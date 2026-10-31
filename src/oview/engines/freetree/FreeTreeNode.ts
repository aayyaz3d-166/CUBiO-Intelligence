/**
 * FreeTree Engine — AST & Sovereign Document Nodes
 * ============================================================================
 * FreeTreeNode.ts: The fundamental data structures of the FreeTree Engine,
 * the zero-bloat, high-performance execution & layout engine powering CUBiO Browser.
 */

export type FreeTreeNodeType = 'document' | 'element' | 'text' | 'script' | 'style' | 'comment';

export interface FreeTreeEventMap {
  [eventName: string]: string; // Maps event like 'click', 'hover' to handler function/expression
}

export interface FreeTreeProperties {
  [key: string]: any;
}

export interface BaseFreeTreeNode {
  id: string;
  type: FreeTreeNodeType;
  parentId: string | null;
}

export interface FreeTreeTextNode extends BaseFreeTreeNode {
  type: 'text';
  text: string;
}

export interface FreeTreeCommentNode extends BaseFreeTreeNode {
  type: 'comment';
  comment: string;
}

export interface FreeTreeScriptNode extends BaseFreeTreeNode {
  type: 'script';
  scriptType: 'one' | 'cubio' | 'bytecode';
  source: string;
}

export interface FreeTreeStyleNode extends BaseFreeTreeNode {
  type: 'style';
  cssText: string;
  parsedRules: Record<string, Record<string, string>>;
}

export interface FreeTreeElementNode extends BaseFreeTreeNode {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  style: Record<string, string>;
  classes: string[];
  events: FreeTreeEventMap;
  properties: FreeTreeProperties;
  children: FreeTreeNode[];
}

export interface FreeTreeDocumentNode extends BaseFreeTreeNode {
  type: 'document';
  title: string;
  protocol: string;
  url: string;
  metadata: Record<string, string>;
  body: FreeTreeElementNode;
  scripts: FreeTreeScriptNode[];
  styles: FreeTreeStyleNode[];
}

export type FreeTreeNode =
  | FreeTreeDocumentNode
  | FreeTreeElementNode
  | FreeTreeTextNode
  | FreeTreeScriptNode
  | FreeTreeStyleNode
  | FreeTreeCommentNode;

let nodeIdCounter = 1;

export function generateNodeId(prefix: string = 'ft_node'): string {
  return `${prefix}_${Date.now()}_${nodeIdCounter++}`;
}

export function createTextNode(text: string, parentId: string | null = null): FreeTreeTextNode {
  return {
    id: generateNodeId('text'),
    type: 'text',
    parentId,
    text,
  };
}

export function createElementNode(
  tag: string,
  attributes: Record<string, string> = {},
  children: FreeTreeNode[] = [],
  parentId: string | null = null
): FreeTreeElementNode {
  const classes = (attributes['class'] || attributes['className'] || '')
    .split(/\s+/)
    .filter(Boolean);

  const styleAttr = attributes['style'] || '';
  const style: Record<string, string> = {};
  if (styleAttr) {
    styleAttr.split(';').forEach(rule => {
      const idx = rule.indexOf(':');
      if (idx > 0) {
        const key = rule.slice(0, idx).trim();
        const val = rule.slice(idx + 1).trim();
        if (key && val) style[key] = val;
      }
    });
  }

  const events: FreeTreeEventMap = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (k.startsWith('on-') || k.startsWith('on:')) {
      const evtName = k.slice(3).toLowerCase();
      events[evtName] = v;
    } else if (k.startsWith('on') && k.length > 2) {
      const evtName = k.slice(2).toLowerCase();
      events[evtName] = v;
    }
  }

  return {
    id: generateNodeId('elem'),
    type: 'element',
    tag: tag.toLowerCase(),
    attributes,
    style,
    classes,
    events,
    properties: {},
    children,
    parentId,
  };
}

export function createDocumentNode(url: string = 'cubio://blank', title: string = 'Untitled Document'): FreeTreeDocumentNode {
  const docId = generateNodeId('doc');
  const body = createElementNode('body', {}, [], docId);

  return {
    id: docId,
    type: 'document',
    title,
    protocol: url.split('://')[0] || 'cubio',
    url,
    metadata: {},
    body,
    scripts: [],
    styles: [],
    parentId: null,
  };
}
