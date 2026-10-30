/**
 * OLTO Frontend Subsystem — Direct DOM Renderer & Reactive Binder
 * ================================================================
 * Implements fine-grained DOM bindings with zero virtual DOM diffing.
 * Operates universally across Web Browser DOM and Headless Node environments.
 */

import { createEffect } from './Signal';

export interface OltoEvent {
  type: string;
  target?: any;
  defaultPrevented?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  data?: any;
}

export class OltoDOMTextNode {
  public text: string;
  public parent: OltoDOMElement | null = null;

  constructor(text: string) {
    this.text = text;
  }

  public renderToHTML(): string {
    return escapeHTML(this.text);
  }
}

export class OltoDOMElement {
  public tagName: string;
  public attributes: Map<string, string | number | boolean> = new Map();
  public children: (OltoDOMElement | OltoDOMTextNode)[] = [];
  public listeners: Map<string, ((e: OltoEvent) => void)[]> = new Map();
  public parent: OltoDOMElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  public setAttribute(name: string, value: string | number | boolean): void {
    this.attributes.set(name, value);
  }

  public getAttribute(name: string): string | number | boolean | undefined {
    return this.attributes.get(name);
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  public appendChild(child: OltoDOMElement | OltoDOMTextNode): void {
    child.parent = this;
    this.children.push(child);
  }

  public removeChild(child: OltoDOMElement | OltoDOMTextNode): void {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parent = null;
      this.children.splice(idx, 1);
    }
  }

  public clearChildren(): void {
    for (const c of this.children) {
      c.parent = null;
    }
    this.children = [];
  }

  public addEventListener(event: string, handler: (e: OltoEvent) => void): void {
    const list = this.listeners.get(event) || [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  public removeEventListener(event: string, handler: (e: OltoEvent) => void): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
  }

  public dispatchEvent(event: string, data?: any): boolean {
    const handlers = this.listeners.get(event);
    let prevented = false;

    const oltoEvent: OltoEvent = {
      type: event,
      target: this,
      data,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => {},
    };

    if (handlers) {
      for (const h of handlers) {
        h(oltoEvent);
      }
    }

    return !prevented;
  }

  public renderToHTML(): string {
    const tag = this.tagName.toLowerCase();
    const attrs: string[] = [];

    for (const [k, v] of this.attributes.entries()) {
      if (typeof v === 'boolean') {
        if (v) attrs.push(k);
      } else {
        attrs.push(`${k}="${escapeHTML(String(v))}"`);
      }
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    const innerHTML = this.children.map((c) => c.renderToHTML()).join('');

    return `<${tag}${attrStr}>${innerHTML}</${tag}>`;
  }
}

export class OltoDOMRenderer {
  public static createElement(tagName: string): OltoDOMElement {
    return new OltoDOMElement(tagName);
  }

  public static createTextNode(initialText: string): OltoDOMTextNode {
    return new OltoDOMTextNode(initialText);
  }

  /**
   * Directly binds a signal to a text node with micro-second reactive patching.
   */
  public static bindText(textSignal: () => any): OltoDOMTextNode {
    const node = new OltoDOMTextNode(String(textSignal()));

    createEffect(() => {
      const val = textSignal();
      node.text = String(val !== undefined && val !== null ? val : '');
    });

    return node;
  }

  /**
   * Directly binds a signal to an element attribute.
   */
  public static bindAttribute(
    element: OltoDOMElement,
    attributeName: string,
    valueSignal: () => any
  ): void {
    createEffect(() => {
      const val = valueSignal();
      if (val === false || val === undefined || val === null) {
        element.removeAttribute(attributeName);
      } else {
        element.setAttribute(attributeName, val);
      }
    });
  }

  /**
   * Direct conditional branch rendering.
   */
  public static bindConditional(
    conditionSignal: () => boolean,
    createThen: () => OltoDOMElement,
    createElse?: () => OltoDOMElement
  ): OltoDOMElement {
    const container = new OltoDOMElement('div');
    container.setAttribute('class', 'olto-conditional-container');

    let currentBranch: OltoDOMElement | null = null;
    let prevCondition: boolean | null = null;

    createEffect(() => {
      const condition = conditionSignal();
      if (condition === prevCondition) return;
      prevCondition = condition;

      container.clearChildren();
      if (condition) {
        currentBranch = createThen();
      } else if (createElse) {
        currentBranch = createElse();
      } else {
        currentBranch = null;
      }

      if (currentBranch) {
        container.appendChild(currentBranch);
      }
    });

    return container;
  }

  /**
   * Fine-grained list iteration rendering.
   */
  public static bindList<T>(
    listSignal: () => T[],
    renderItem: (item: T, index: number) => OltoDOMElement
  ): OltoDOMElement {
    const container = new OltoDOMElement('div');
    container.setAttribute('class', 'olto-list-container');

    createEffect(() => {
      const items = listSignal();
      container.clearChildren();

      for (let i = 0; i < items.length; i++) {
        const itemElem = renderItem(items[i], i);
        container.appendChild(itemElem);
      }
    });

    return container;
  }
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
