/**
 * Oview OS — Native Calculator Application Controller
 * ====================================================
 * CalculatorApp.ts: Sovereign scientific and basic math evaluator with
 * expression parsing, calculation history, and error recovery.
 */

import { OltoDOMRenderer, OltoDOMElement } from '../../../olto/runtime/OltoDOMRenderer';

export class CalculatorApp {
  public display: string = '0';
  public equation: string = '';
  public history: { equation: string; result: string }[] = [];
  public isScientific: boolean = false;
  private shouldResetOnNextInput: boolean = false;

  constructor(initialDisplay: string = '0') {
    this.display = initialDisplay;
  }

  public inputDigit(digit: string): void {
    if (this.shouldResetOnNextInput || this.display === '0') {
      this.display = digit;
      this.shouldResetOnNextInput = false;
    } else {
      this.display += digit;
    }
  }

  public inputDot(): void {
    if (this.shouldResetOnNextInput) {
      this.display = '0.';
      this.shouldResetOnNextInput = false;
      return;
    }
    const lastNum = this.display.split(/[+\-×÷*/]/).pop() || '';
    if (!lastNum.includes('.')) {
      this.display += '.';
    }
  }

  public inputOperator(op: string): void {
    this.shouldResetOnNextInput = false;
    const lastChar = this.display.slice(-1);
    if (['+', '-', '×', '÷', '*', '/'].includes(lastChar)) {
      this.display = this.display.slice(0, -1) + op;
    } else {
      this.display += op;
    }
  }

  public clear(): void {
    this.display = '0';
    this.equation = '';
    this.shouldResetOnNextInput = false;
  }

  public backspace(): void {
    if (this.display.length <= 1) {
      this.display = '0';
    } else {
      this.display = this.display.slice(0, -1);
    }
  }

  public toggleSign(): void {
    if (this.display !== '0') {
      if (this.display.startsWith('-')) {
        this.display = this.display.substring(1);
      } else {
        this.display = '-' + this.display;
      }
    }
  }

  public evaluate(): string {
    const raw = this.display.replace(/×/g, '*').replace(/÷/g, '/');
    try {
      // Safe sanitized evaluation
      const sanitized = raw.replace(/[^0-9+\-*/().%^ \t]/g, '');
      // eslint-disable-next-line no-eval
      const res = Function(`"use strict"; return (${sanitized})`)();
      const resultStr = String(Number(res.toFixed(8)));

      this.history.push({ equation: this.display, result: resultStr });
      this.equation = this.display + ' =';
      this.display = resultStr;
      this.shouldResetOnNextInput = true;
      return resultStr;
    } catch {
      this.display = 'Error';
      this.shouldResetOnNextInput = true;
      return 'Error';
    }
  }

  public calculateScientific(func: 'sqrt' | 'sin' | 'cos' | 'tan' | 'log' | 'sqr'): void {
    const val = parseFloat(this.display);
    if (isNaN(val)) return;

    let res = 0;
    switch (func) {
      case 'sqrt':
        res = Math.sqrt(val);
        break;
      case 'sin':
        res = Math.sin((val * Math.PI) / 180);
        break;
      case 'cos':
        res = Math.cos((val * Math.PI) / 180);
        break;
      case 'tan':
        res = Math.tan((val * Math.PI) / 180);
        break;
      case 'log':
        res = Math.log10(val);
        break;
      case 'sqr':
        res = val * val;
        break;
    }

    const resultStr = String(Number(res.toFixed(8)));
    this.history.push({ equation: `${func}(${val})`, result: resultStr });
    this.display = resultStr;
    this.shouldResetOnNextInput = true;
  }

  /**
   * Universal DOM Renderer for Calculator GUI.
   */
  public renderToElement(): OltoDOMElement {
    const container = OltoDOMRenderer.createElement('div');
    container.setAttribute('class', 'oview-app-calculator');
    container.setAttribute(
      'style',
      'display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f8fafc;'
    );

    // Screen
    const screen = OltoDOMRenderer.createElement('div');
    screen.setAttribute(
      'style',
      'background: rgba(0, 0, 0, 0.4); border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-height: 60px;'
    );

    if (this.equation) {
      const eqEl = OltoDOMRenderer.createElement('span');
      eqEl.setAttribute('style', 'font-size: 11px; color: #94a3b8; margin-bottom: 2px;');
      eqEl.appendChild(OltoDOMRenderer.createTextNode(this.equation));
      screen.appendChild(eqEl);
    }

    const valEl = OltoDOMRenderer.createElement('span');
    valEl.setAttribute('style', 'font-size: 26px; font-weight: 700; color: #10b981; font-family: monospace; letter-spacing: 1px;');
    valEl.appendChild(OltoDOMRenderer.createTextNode(this.display));
    screen.appendChild(valEl);

    container.appendChild(screen);

    // Keypad Grid (4 Columns)
    const grid = OltoDOMRenderer.createElement('div');
    grid.setAttribute('style', 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex: 1;');

    const buttons = [
      { label: 'C', variant: 'ctrl' },
      { label: '±', variant: 'ctrl' },
      { label: '⌫', variant: 'ctrl' },
      { label: '÷', variant: 'op' },
      { label: '7', variant: 'num' },
      { label: '8', variant: 'num' },
      { label: '9', variant: 'num' },
      { label: '×', variant: 'op' },
      { label: '4', variant: 'num' },
      { label: '5', variant: 'num' },
      { label: '6', variant: 'num' },
      { label: '-', variant: 'op' },
      { label: '1', variant: 'num' },
      { label: '2', variant: 'num' },
      { label: '3', variant: 'num' },
      { label: '+', variant: 'op' },
      { label: '0', variant: 'num', span: 2 },
      { label: '.', variant: 'num' },
      { label: '=', variant: 'eq' },
    ];

    for (const btn of buttons) {
      const b = OltoDOMRenderer.createElement('button');
      let bg = 'rgba(255, 255, 255, 0.05)';
      let col = '#f8fafc';
      let border = '1px solid rgba(255, 255, 255, 0.08)';

      if (btn.variant === 'op') {
        bg = 'rgba(16, 185, 129, 0.2)';
        col = '#10b981';
        border = '1px solid rgba(16, 185, 129, 0.3)';
      } else if (btn.variant === 'eq') {
        bg = '#10b981';
        col = '#fff';
        border = 'none';
      } else if (btn.variant === 'ctrl') {
        bg = 'rgba(255, 255, 255, 0.08)';
        col = '#cbd5e1';
      }

      const spanStyle = btn.span ? `grid-column: span ${btn.span};` : '';
      b.setAttribute(
        'style',
        `display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: ${bg}; color: ${col}; border: ${border}; ${spanStyle}`
      );
      b.appendChild(OltoDOMRenderer.createTextNode(btn.label));
      grid.appendChild(b);
    }

    container.appendChild(grid);
    return container;
  }
}
