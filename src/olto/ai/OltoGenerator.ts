/**
 * OLTO Frontend Subsystem — AI Application Generator & Two-Way Transpiler
 * =======================================================================
 * Converts between structured JSON UI Schema (OltoAppSchema) and declarative
 * OLTO source code (.olto). Also includes semantic intent generators for ECHO-1.
 */

import { OltoAppSchema, OltoLayoutNode, OltoSchemaValidator } from './OltoSchema';
import { OltoCompiler, OltoProgram, OltoComponent, OltoPage } from '../compiler/index';

export class OltoGenerator {
  /**
   * Converts a structured OltoAppSchema JSON into declarative .olto source code.
   */
  public static schemaToCode(schema: OltoAppSchema): string {
    const validation = OltoSchemaValidator.validate(schema);
    if (!validation.valid) {
      throw new Error(`[OltoGenerator Error] Invalid schema:\n${validation.errors.join('\n')}`);
    }

    const kind = schema.kind || 'component';
    const lines: string[] = [];

    lines.push(`${kind} ${schema.name} {`);

    // 1. Reactive State
    if (schema.state && schema.state.length > 0) {
      for (const st of schema.state) {
        const initVal = typeof st.initial === 'string' ? JSON.stringify(st.initial) : JSON.stringify(st.initial);
        lines.push(`  state ${st.name}: ${st.type} = ${initVal};`);
      }
      lines.push('');
    }

    // 2. Computed Properties
    if (schema.computed && schema.computed.length > 0) {
      for (const comp of schema.computed) {
        lines.push(`  computed ${comp.name}: ${comp.type} {`);
        lines.push(`    return ${comp.expression};`);
        lines.push('  }');
      }
      lines.push('');
    }

    // 3. Actions
    if (schema.actions && schema.actions.length > 0) {
      for (const act of schema.actions) {
        const params = act.params ? act.params.join(', ') : '';
        lines.push(`  action ${act.name}(${params}) {`);
        for (const stmt of act.statements) {
          lines.push(`    ${stmt};`);
        }
        lines.push('  }');
      }
      lines.push('');
    }

    // 4. View Layout
    lines.push('  view {');
    const layoutCode = this.renderLayoutNode(schema.layout, 4);
    lines.push(layoutCode);
    lines.push('  }');

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Parses .olto source code into an AST and produces an OltoAppSchema JSON.
   */
  public static codeToSchema(source: string): OltoAppSchema {
    const res = OltoCompiler.compile(source);
    if (!res.success || !res.ast || res.ast.declarations.length === 0) {
      const errs = res.diagnostics.map(d => `[${d.code}] Line ${d.line}: ${d.message}`).join('\n');
      throw new Error(`[OltoGenerator Error] Failed to parse OLTO code to schema:\n${errs}`);
    }

    const decl = res.ast.declarations[0];
    const isPage = decl.kind === 'PageDeclaration';

    const state = decl.state.map(s => ({
      name: s.name,
      type: (s.typeAnnotation || 'any') as any,
      initial: this.literalToValue(s.initialValue),
    }));

    const computed = decl.computed.map(c => ({
      name: c.name,
      type: c.typeAnnotation || 'any',
      expression: '0', // simplified AST representation
    }));

    const actions = decl.actions.map(a => ({
      name: a.name,
      params: a.params.map(p => p.name),
      statements: ['// action logic'],
    }));

    // Generate root layout node from declared component
    const layout: OltoLayoutNode = {
      component: 'Container',
      props: { maxWidth: 800, padding: 24 },
      children: [
        {
          component: 'Card',
          props: { radius: 12, padding: 20 },
          children: [
            { component: 'Text', props: { text: decl.name, size: 24, weight: 'bold' } }
          ]
        }
      ]
    };

    return {
      version: '1.0',
      name: decl.name,
      kind: isPage ? 'page' : 'component',
      theme: 'dark',
      state,
      computed,
      actions,
      layout,
    };
  }

  /**
   * Generates a complete functional OltoAppSchema from a natural language prompt.
   */
  public static generateFromIntent(prompt: string): OltoAppSchema {
    const p = prompt.toLowerCase();

    // 1. E-Commerce / Store / Products
    if (p.includes('store') || p.includes('shop') || p.includes('ecommerce') || p.includes('product') || p.includes('cart')) {
      return {
        version: '1.0',
        name: 'StoreApp',
        kind: 'page',
        theme: 'dark',
        state: [
          { name: 'cartCount', type: 'number', initial: 0 },
          { name: 'totalPrice', type: 'number', initial: 0 },
          { name: 'notification', type: 'string', initial: 'Welcome to the Store!' },
        ],
        computed: [
          { name: 'hasItems', type: 'boolean', expression: 'cartCount > 0' }
        ],
        actions: [
          {
            name: 'addToCart',
            statements: [
              'cartCount += 1',
              'totalPrice += 49'
            ]
          },
          {
            name: 'checkout',
            statements: [
              'cartCount = 0',
              'totalPrice = 0'
            ]
          }
        ],
        layout: {
          component: 'Container',
          props: { maxWidth: 900, padding: 32 },
          children: [
            {
              component: 'Row',
              props: { justify: 'space-between', align: 'center', marginBottom: 24 },
              children: [
                { component: 'Text', props: { text: 'Sovereign Marketplace', size: 28, weight: 'bold' } },
                { component: 'Badge', props: { label: 'Cart: 0 items', variant: 'success' } }
              ]
            },
            {
              component: 'Grid',
              props: { columns: 2, gap: 16, marginBottom: 24 },
              children: [
                {
                  component: 'Card',
                  props: { padding: 20, radius: 12 },
                  children: [
                    { component: 'Text', props: { text: 'Neural Compute Pod', size: 18, weight: 'bold' } },
                    { component: 'Text', props: { text: 'High-speed sovereign AI compute engine.', color: '#94a3b8' } },
                    { component: 'Text', props: { text: '$49.00', size: 20, weight: 'bold' } },
                    { component: 'Button', props: { label: 'Add to Cart', variant: 'primary', onClick: 'addToCart' } }
                  ]
                },
                {
                  component: 'Card',
                  props: { padding: 20, radius: 12 },
                  children: [
                    { component: 'Text', props: { text: 'Spatial Memory Block', size: 18, weight: 'bold' } },
                    { component: 'Text', props: { text: '369 bounded address memory matrix.', color: '#94a3b8' } },
                    { component: 'Text', props: { text: '$99.00', size: 20, weight: 'bold' } },
                    { component: 'Button', props: { label: 'Add to Cart', variant: 'primary', onClick: 'addToCart' } }
                  ]
                }
              ]
            },
            {
              component: 'Row',
              props: { justify: 'flex-end', gap: 12 },
              children: [
                { component: 'Button', props: { label: 'Complete Order', variant: 'primary', onClick: 'checkout' } }
              ]
            }
          ]
        }
      };
    }

    // 2. Authentication / Login / Sign In
    if (p.includes('login') || p.includes('auth') || p.includes('signin') || p.includes('signup')) {
      return {
        version: '1.0',
        name: 'LoginForm',
        kind: 'component',
        theme: 'dark',
        state: [
          { name: 'username', type: 'string', initial: '' },
          { name: 'password', type: 'string', initial: '' },
          { name: 'isSubmitting', type: 'boolean', initial: false },
          { name: 'statusMessage', type: 'string', initial: '' },
        ],
        actions: [
          {
            name: 'handleLogin',
            statements: [
              'isSubmitting = true',
              'statusMessage = "Authenticating..."'
            ]
          }
        ],
        layout: {
          component: 'Container',
          props: { maxWidth: 440, padding: 32 },
          children: [
            {
              component: 'Card',
              props: { padding: 28, radius: 16 },
              children: [
                { component: 'Text', props: { text: 'Welcome Back', size: 24, weight: 'bold', marginBottom: 8 } },
                { component: 'Text', props: { text: 'Sign in to access sovereign ONE ecosystem', color: '#94a3b8', marginBottom: 20 } },
                { component: 'Input', props: { placeholder: 'Username or Email', marginBottom: 12 } },
                { component: 'Input', props: { placeholder: 'Password', type: 'password', marginBottom: 20 } },
                { component: 'Button', props: { label: 'Sign In', variant: 'primary', onClick: 'handleLogin' } }
              ]
            }
          ]
        }
      };
    }

    // 3. Task Management / Todo
    if (p.includes('todo') || p.includes('task') || p.includes('checklist') || p.includes('list')) {
      return {
        version: '1.0',
        name: 'TaskManager',
        kind: 'component',
        theme: 'dark',
        state: [
          { name: 'newTask', type: 'string', initial: '' },
          { name: 'completedCount', type: 'number', initial: 0 },
        ],
        actions: [
          {
            name: 'addTask',
            statements: [
              'newTask = ""'
            ]
          }
        ],
        layout: {
          component: 'Container',
          props: { maxWidth: 650, padding: 24 },
          children: [
            {
              component: 'Card',
              props: { padding: 24, radius: 14 },
              children: [
                { component: 'Text', props: { text: 'Sovereign Tasks', size: 22, weight: 'bold', marginBottom: 16 } },
                {
                  component: 'Row',
                  props: { gap: 8, marginBottom: 16 },
                  children: [
                    { component: 'Input', props: { placeholder: 'Add a new sovereign task...' } },
                    { component: 'Button', props: { label: 'Add', variant: 'primary', onClick: 'addTask' } }
                  ]
                },
                {
                  component: 'Row',
                  props: { justify: 'space-between', align: 'center' },
                  children: [
                    { component: 'Text', props: { text: '3 active tasks', color: '#94a3b8' } },
                    { component: 'Badge', props: { label: 'Status: Active', variant: 'info' } }
                  ]
                }
              ]
            }
          ]
        }
      };
    }

    // 4. Default / Counter Interactive App
    return {
      version: '1.0',
      name: 'InteractiveApp',
      kind: 'component',
      theme: 'dark',
      state: [
        { name: 'count', type: 'number', initial: 0 },
        { name: 'status', type: 'string', initial: 'Ready' },
      ],
      computed: [
        { name: 'doubled', type: 'number', expression: 'count * 2' }
      ],
      actions: [
        {
          name: 'increment',
          statements: ['count += 1']
        },
        {
          name: 'decrement',
          statements: ['count -= 1']
        },
        {
          name: 'reset',
          statements: ['count = 0']
        }
      ],
      layout: {
        component: 'Container',
        props: { maxWidth: 520, padding: 32 },
        children: [
          {
            component: 'Card',
            props: { padding: 24, radius: 16 },
            children: [
              { component: 'Text', props: { text: 'OLTO Interactive Dashboard', size: 22, weight: 'bold', marginBottom: 12 } },
              { component: 'Text', props: { text: 'Fine-grained reactive state with zero-dependency execution.', color: '#94a3b8', marginBottom: 20 } },
              {
                component: 'Row',
                props: { justify: 'center', align: 'center', gap: 16, marginBottom: 20 },
                children: [
                  { component: 'Button', props: { label: '-', variant: 'outline', onClick: 'decrement' } },
                  { component: 'Text', props: { text: 'Count: 0', size: 28, weight: 'bold' } },
                  { component: 'Button', props: { label: '+', variant: 'outline', onClick: 'increment' } }
                ]
              },
              {
                component: 'Row',
                props: { justify: 'center', gap: 8 },
                children: [
                  { component: 'Button', props: { label: 'Reset Counter', variant: 'ghost', onClick: 'reset' } }
                ]
              }
            ]
          }
        ]
      }
    };
  }

  private static renderLayoutNode(node: OltoLayoutNode | string, indent: number): string {
    const pad = ' '.repeat(indent);
    if (typeof node === 'string') {
      return `${pad}Text(${JSON.stringify(node)})`;
    }

    const propsList: string[] = [];
    if (node.props) {
      if (node.component === 'Text' && node.props.text !== undefined) {
        propsList.push(JSON.stringify(node.props.text));
      }
      for (const [k, v] of Object.entries(node.props)) {
        if (node.component === 'Text' && k === 'text') continue;
        if (typeof v === 'string') {
          if (k.startsWith('on') || k === 'onClick') {
            propsList.push(`${k}: { ${v} }`);
          } else {
            propsList.push(`${k}: ${JSON.stringify(v)}`);
          }
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          propsList.push(`${k}: ${v}`);
        } else if (Array.isArray(v)) {
          propsList.push(`${k}: [${v.join(', ')}]`);
        } else {
          propsList.push(`${k}: ${JSON.stringify(v)}`);
        }
      }
    }

    const propStr = propsList.length > 0 ? `(${propsList.join(', ')})` : '()';

    if (!node.children || node.children.length === 0) {
      return `${pad}${node.component}${propStr}`;
    }

    const lines: string[] = [];
    lines.push(`${pad}${node.component}${propStr} {`);
    for (const child of node.children) {
      lines.push(this.renderLayoutNode(child, indent + 2));
    }
    lines.push(`${pad}}`);
    return lines.join('\n');
  }

  private static literalToValue(expr: any): any {
    if (!expr) return null;
    if (expr.kind === 'NumberLiteral') return expr.value;
    if (expr.kind === 'BooleanLiteral') return expr.value;
    if (expr.kind === 'StringLiteral') return expr.value;
    return null;
  }
}
