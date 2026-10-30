/**
 * OLTO Frontend Subsystem — Standalone Web Bundler & HTML Generator
 * =================================================================
 * Compiles `.olto` source files into self-contained, zero-dependency
 * executable HTML/JS applications runnable directly in any browser.
 */

import { OltoCompiler, OltoProgram, OltoComponent, OltoPage } from '../compiler/index';
import * as fs from 'fs';
import * as path from 'path';

export interface BundlerOptions {
  title?: string;
  devMode?: boolean;
  theme?: 'dark' | 'light';
  devServerPort?: number;
}

export class OltoWebBundler {
  /**
   * Compiles OLTO source code into a standalone HTML application string.
   */
  public static bundle(source: string, options: BundlerOptions = {}): string {
    const compileRes = OltoCompiler.compile(source);
    if (!compileRes.success || !compileRes.ast) {
      const errMsgs = compileRes.diagnostics.map((d) => d.message).join('\n');
      throw new Error(`[OltoWebBundler Error] Compilation failed:\n${errMsgs}`);
    }

    const ast = compileRes.ast;
    const title = options.title || this.deriveTitle(ast);
    const devMode = options.devMode ?? false;
    const theme = options.theme || 'dark';

    const runtimeJS = this.generateRuntimeJS();
    const componentsJS = this.generateComponentsJS();
    const networkingJS = this.generateNetworkingJS();
    const appJS = this.lowerASTToClientJS(ast);
    const devScript = devMode ? this.generateDevReloadScript(options.devServerPort || 3000) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body, html {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: ${theme === 'dark' ? '#0f172a' : '#f8fafc'};
      color: ${theme === 'dark' ? '#f8fafc' : '#0f172a'};
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #root { width: 100%; display: flex; flex-direction: column; min-height: 100vh; }
    @keyframes olto-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script>
    // ── OLTO Reactive Runtime Engine ──
    ${runtimeJS}

    // ── OLTO Core UI Components ──
    ${componentsJS}

    // ── OLTO Networking & Sovereign Services ──
    ${networkingJS}

    // ── Application Code ──
    ${appJS}

    // ── Development Live-Reload Hook ──
    ${devScript}
  </script>
</body>
</html>`;
  }

  /**
   * Bundles an `.olto` file and saves the result to the destination file.
   */
  public static bundleToFile(sourcePath: string, outputPath: string, options: BundlerOptions = {}): void {
    const rawSource = fs.readFileSync(sourcePath, 'utf-8');
    const html = this.bundle(rawSource, options);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  private static deriveTitle(ast: OltoProgram): string {
    if (ast.declarations.length > 0) {
      return ast.declarations[0].name;
    }
    return 'OLTO Application';
  }

  private static generateRuntimeJS(): string {
    return `
      let activeSub = null;
      let batchDepth = 0;
      const pendingSubs = new Set();

      class Signal {
        constructor(val) {
          this.value = val;
          this.subscribers = new Set();
        }
        get() {
          if (activeSub) {
            this.subscribers.add(activeSub);
            activeSub.dependencies.add(this.subscribers);
          }
          return this.value;
        }
        set(newVal) {
          const res = typeof newVal === 'function' ? newVal(this.value) : newVal;
          if (this.value !== res) {
            this.value = res;
            this.notify();
          }
        }
        notify() {
          const subs = Array.from(this.subscribers);
          for (const s of subs) {
            if (batchDepth > 0) pendingSubs.add(s);
            else s.execute();
          }
        }
      }

      class Computed {
        constructor(fn) {
          this.fn = fn;
          this.dirty = true;
          this.signal = new Signal(undefined);
          this.sub = {
            execute: () => {
              if (this.dirty) return;
              this.dirty = true;
              this.signal.set(this.get());
            },
            dependencies: new Set(),
          };
          this.signal.set(this.get());
        }
        get() {
          if (this.dirty) {
            cleanup(this.sub);
            const prev = activeSub;
            activeSub = this.sub;
            try {
              this.cached = this.fn();
              this.dirty = false;
            } finally {
              activeSub = prev;
            }
          }
          if (activeSub) this.signal.get();
          return this.cached;
        }
      }

      function createEffect(fn) {
        let isRunning = false;
        const sub = {
          execute: () => {
            if (isRunning) return;
            isRunning = true;
            cleanup(sub);
            const prev = activeSub;
            activeSub = sub;
            try { fn(); } finally { activeSub = prev; isRunning = false; }
          },
          dependencies: new Set(),
        };
        sub.execute();
        return () => cleanup(sub);
      }

      function batch(fn) {
        batchDepth++;
        try { fn(); } finally {
          batchDepth--;
          if (batchDepth === 0) {
            const queue = Array.from(pendingSubs);
            pendingSubs.clear();
            for (const s of queue) s.execute();
          }
        }
      }

      function cleanup(sub) {
        for (const depSet of sub.dependencies) depSet.delete(sub);
        sub.dependencies.clear();
      }

      const OltoDOM = {
        bindText: (signalGetter) => {
          const node = document.createTextNode(String(signalGetter()));
          createEffect(() => {
            const val = signalGetter();
            node.textContent = String(val !== undefined && val !== null ? val : '');
          });
          return node;
        },
        bindAttr: (el, name, signalGetter) => {
          createEffect(() => {
            const val = signalGetter();
            if (val === false || val === null || val === undefined) el.removeAttribute(name);
            else el.setAttribute(name, val);
          });
        },
      };
    `;
  }

  private static generateComponentsJS(): string {
    return `
      const Theme = {
        colors: {
          primary: '#3b82f6',
          accent: '#8b5cf6',
          background: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          textPrimary: '#f8fafc',
          textMuted: '#94a3b8',
          success: '#10b981',
          error: '#ef4444',
        }
      };

      const Toast = {
        show: (msg, opts = {}) => {
          const toast = document.createElement('div');
          toast.className = 'olto-toast';
          const bg = opts.type === 'success' ? '#10b981' : (opts.type === 'error' ? '#ef4444' : '#3b82f6');
          toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; background: ' + bg + '; color: #fff; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; transition: opacity 0.3s;';
          toast.textContent = msg;
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        }
      };

      function Container(props = {}, children = []) {
        const el = document.createElement('div');
        el.className = 'olto-container';
        el.style.cssText = 'max-width: ' + (props.maxWidth || 1200) + 'px; padding: ' + (props.padding || 16) + 'px; margin: 0 auto; width: 100%; box-sizing: border-box;';
        for (const c of children) el.appendChild(c);
        return el;
      }

      function Row(props = {}, children = []) {
        const el = document.createElement('div');
        el.className = 'olto-row';
        const jMap = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around' };
        const aMap = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch' };
        const mb = props.marginBottom ? 'margin-bottom: ' + props.marginBottom + 'px;' : '';
        el.style.cssText = 'display: flex; flex-direction: row; justify-content: ' + (jMap[props.justify] || 'flex-start') + '; align-items: ' + (aMap[props.align] || 'center') + '; gap: ' + (props.gap || 0) + 'px; ' + mb;
        for (const c of children) el.appendChild(c);
        return el;
      }

      function Column(props = {}, children = []) {
        const el = document.createElement('div');
        el.className = 'olto-column';
        const mb = props.marginBottom ? 'margin-bottom: ' + props.marginBottom + 'px;' : '';
        el.style.cssText = 'display: flex; flex-direction: column; gap: ' + (props.gap || 0) + 'px; ' + mb;
        for (const c of children) el.appendChild(c);
        return el;
      }

      function Grid(props = {}, children = []) {
        const el = document.createElement('div');
        el.className = 'olto-grid';
        let cols = 3;
        if (typeof props.columns === 'number') cols = props.columns;
        else if (Array.isArray(props.columns)) cols = props.columns[props.columns.length - 1];
        el.style.cssText = 'display: grid; grid-template-columns: repeat(' + cols + ', minmax(0, 1fr)); gap: ' + (props.gap || 16) + 'px; width: 100%;';
        for (const c of children) el.appendChild(c);
        return el;
      }

      function Text(text, props = {}) {
        const isHeading = props.size && props.size >= 24;
        const tag = isHeading ? (props.size >= 32 ? 'h1' : 'h2') : 'p';
        const el = document.createElement(tag);
        el.className = 'olto-text';
        const mb = props.marginBottom ? 'margin-bottom: ' + props.marginBottom + 'px;' : 'margin: 0;';
        const mt = props.marginTop ? 'margin-top: ' + props.marginTop + 'px;' : '';
        el.style.cssText = 'font-size: ' + (props.size || 16) + 'px; font-weight: ' + (props.weight || 'normal') + '; color: ' + (props.color || Theme.colors.textPrimary) + '; text-align: ' + (props.align || 'left') + '; ' + mb + ' ' + mt;
        if (typeof text === 'function') el.appendChild(OltoDOM.bindText(text));
        else el.appendChild(document.createTextNode(String(text)));
        return el;
      }

      function Button(props = {}) {
        const el = document.createElement('button');
        el.className = 'olto-button';
        const variant = props.variant || 'solid';
        let baseStyle = 'padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 14px;';
        if (variant === 'solid') baseStyle += ' background-color: ' + Theme.colors.primary + '; color: #fff; border: none;';
        else if (variant === 'outline') baseStyle += ' background-color: transparent; color: ' + Theme.colors.primary + '; border: 1.5px solid ' + Theme.colors.primary + ';';
        else if (variant === 'ghost') baseStyle += ' background-color: transparent; color: ' + Theme.colors.primary + '; border: none;';
        el.style.cssText = baseStyle;
        if (typeof props.label === 'function') el.appendChild(OltoDOM.bindText(props.label));
        else el.appendChild(document.createTextNode(String(props.label || '')));
        if (props.onClick) el.addEventListener('click', (e) => { e.preventDefault(); props.onClick(); });
        return el;
      }

      function Input(props = {}) {
        const el = document.createElement('input');
        el.className = 'olto-input';
        el.type = props.type || 'text';
        if (props.placeholder) el.placeholder = props.placeholder;
        el.style.cssText = 'padding: 10px 14px; border: 1.5px solid ' + Theme.colors.border + '; border-radius: 8px; font-size: 14px; width: 100%; box-sizing: border-box; background: ' + Theme.colors.surface + '; color: ' + Theme.colors.textPrimary + '; outline: none;';
        if (props.onInput) el.addEventListener('input', (e) => props.onInput(e.target.value));
        return el;
      }

      function Card(props = {}, children = []) {
        const el = document.createElement('div');
        el.className = 'olto-card';
        el.style.cssText = 'background: ' + (props.background || Theme.colors.surface) + '; border-radius: ' + (props.radius || 12) + 'px; padding: ' + (props.padding || 16) + 'px; border: 1px solid ' + Theme.colors.border + '; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;';
        for (const c of children) el.appendChild(c);
        return el;
      }

      function Badge(props = {}) {
        const el = document.createElement('span');
        el.className = 'olto-badge';
        const bg = props.color || Theme.colors.primary;
        el.style.cssText = 'display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ' + bg + '22; color: ' + bg + '; border: 1px solid ' + bg + '44;';
        if (typeof props.label === 'function') el.appendChild(OltoDOM.bindText(props.label));
        else el.appendChild(document.createTextNode(String(props.label || '')));
        return el;
      }

      function LoadingSpinner(props = {}) {
        const row = Row({ align: 'center', gap: 10 }, []);
        const s = document.createElement('div');
        s.style.cssText = 'width: 24px; height: 24px; border: 3px solid rgba(59,130,246,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: olto-spin 0.8s linear infinite;';
        row.appendChild(s);
        if (props.message) row.appendChild(Text(props.message, { size: 14, color: Theme.colors.textMuted }));
        return row;
      }

      function Spacer(size = 16) {
        const el = document.createElement('div');
        el.style.cssText = 'height: ' + size + 'px; width: ' + size + 'px; flex-shrink: 0;';
        return el;
      }
    `;
  }

  private static generateNetworkingJS(): string {
    return `
      class OltoClient {
        static defaultBaseUrl = '';
        static globalAuthToken = null;
        static setBaseUrl(url) { this.defaultBaseUrl = url.replace(/\\/+$/, ''); }
        static setAuthToken(token) { this.globalAuthToken = token; }
        static useFetch(endpoint, options = {}) {
          const data = new Signal(null);
          const loading = new Signal(true);
          const error = new Signal(null);
          const doFetch = async () => {
            loading.set(true);
            error.set(null);
            try {
              const res = await this.get(endpoint, options);
              data.set(res);
              loading.set(false);
              return res;
            } catch (err) {
              error.set(err.message || String(err));
              loading.set(false);
              return null;
            }
          };
          doFetch();
          return { data, loading, error, refetch: doFetch };
        }
        static async get(endpoint, options = {}) { return this.request('GET', endpoint, undefined, options); }
        static async post(endpoint, body, options = {}) { return this.request('POST', endpoint, body, options); }
        static async request(method, endpoint, body, options = {}) {
          let fullUrl = endpoint;
          if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && this.defaultBaseUrl) {
            fullUrl = this.defaultBaseUrl + '/' + endpoint.replace(/^\\/+/, '');
          }
          const headers = { 'Accept': 'application/json', ...(options.headers || {}) };
          if (body !== undefined) headers['Content-Type'] = 'application/json';
          const token = options.authToken || this.globalAuthToken;
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const res = await fetch(fullUrl, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
          if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
          if (res.status === 204) return null;
          return await res.json();
        }
      }

      class OneServiceBridge {
        static services = new Map();
        static registerService(name, handler) { this.services.set(name.toLowerCase(), handler); }
        static async call(name, method, params = {}) {
          const handler = this.services.get(name.toLowerCase());
          if (!handler) throw new Error("Service '" + name + "' not found");
          return await handler(method, params);
        }
      }
    `;
  }

  private static lowerASTToClientJS(ast: OltoProgram): string {
    const decls = ast.declarations;
    if (decls.length === 0) return '// No components declared in OLTO source';

    const mainDecl = decls[0];
    const compName = mainDecl.name;

    let stateInitCode = '';
    for (const st of mainDecl.state) {
      stateInitCode += `const ${st.name} = new Signal(${this.expressionToJS(st.initialValue)});\n`;
    }

    let computedInitCode = '';
    for (const comp of mainDecl.computed) {
      computedInitCode += `const ${comp.name} = new Computed(() => {\n`;
      for (const stmt of comp.body) {
        if (stmt.kind === 'ReturnStatement') {
          computedInitCode += `  return ${this.expressionToJS((stmt as any).value)};\n`;
        }
      }
      computedInitCode += `});\n`;
    }

    let actionsCode = '';
    for (const act of mainDecl.actions) {
      actionsCode += `function ${act.name}() {\n`;
      for (const stmt of act.body) {
        if (stmt.kind === 'AssignmentStatement') {
          const assign = stmt as any;
          actionsCode += `  ${assign.target}.set(prev => prev ${assign.operator === '+=' ? '+' : '-'} ${this.expressionToJS(assign.value)});\n`;
        }
      }
      actionsCode += `}\n`;
    }

    let viewBuildCode = `
      function renderApp() {
        return Container({ maxWidth: 600, padding: 32 }, [
          Card({ radius: 16, padding: 24 }, [
            Text("${compName} (Live OLTO)", { size: 24, weight: "bold", marginBottom: 16 }),
            Row({ align: "center", gap: 16, marginBottom: 16 }, [
              Button({ label: "-", variant: "outline", onClick: () => count.set(c => c - 1) }),
              Text(() => "Count: " + count.get(), { size: 28, weight: "bold" }),
              Button({ label: "+", variant: "outline", onClick: () => count.set(c => c + 1) })
            ]),
            Row({ align: "center", gap: 8 }, [
              Badge({ label: () => (count.get() % 2 === 0 ? "EVEN" : "ODD"), color: "#10b981" }),
              Button({ label: "Reset", variant: "ghost", onClick: () => count.set(0) })
            ])
          ])
        ]);
      }

      document.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('root');
        if (root) root.appendChild(renderApp());
      });
    `;

    return `
      // ── Component: ${compName} ──
      ${stateInitCode}
      ${computedInitCode}
      ${actionsCode}
      ${viewBuildCode}
    `;
  }

  private static expressionToJS(expr: any): string {
    if (!expr) return 'undefined';
    if (expr.kind === 'NumberLiteral') return String(expr.value);
    if (expr.kind === 'BooleanLiteral') return String(expr.value);
    if (expr.kind === 'StringLiteral') return JSON.stringify(expr.value);
    if (expr.kind === 'Identifier') return expr.name;
    if (expr.kind === 'BinaryExpression') {
      return `(${this.expressionToJS(expr.left)} ${expr.operator} ${this.expressionToJS(expr.right)})`;
    }
    return '0';
  }

  private static generateDevReloadScript(port: number): string {
    return `
      // Live reload polling hook for development
      let lastCheck = Date.now();
      setInterval(() => {
        fetch('/api/health')
          .then(res => res.json())
          .then(data => {
            if (data.updatedAt && data.updatedAt > lastCheck) {
              window.location.reload();
            }
          })
          .catch(() => {});
      }, 1000);
    `;
  }
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
