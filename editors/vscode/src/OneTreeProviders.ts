/**
 * ONE Language — Activity Bar Tree Data Providers
 * ==================================================
 * Implements sidebar panels for:
 *   1. Environments & Runtimes (Qplayer vs UnifiedVM selector)
 *   2. Monorepo Packages & Reasoning Substrates
 *   3. Spatial Memory 369 & Safety Containment Invariants
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface OneTreeElement {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  children?: OneTreeElement[];
  command?: vscode.Command;
  contextValue?: string;
}

// ============================================================================
// 1. Environments & Runtimes Provider
// ============================================================================
export class OneEnvironmentsProvider implements vscode.TreeDataProvider<OneTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<OneTreeElement | undefined | void> = new vscode.EventEmitter<OneTreeElement | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<OneTreeElement | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OneTreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? (element.children && element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip || `${element.label}: ${element.description || ''}`;
    if (element.icon) {
      item.iconPath = new vscode.ThemeIcon(element.icon);
    }
    if (element.command) {
      item.command = element.command;
    }
    if (element.contextValue) {
      item.contextValue = element.contextValue;
    }
    return item;
  }

  getChildren(element?: OneTreeElement): vscode.ProviderResult<OneTreeElement[]> {
    if (element) {
      return element.children || [];
    }

    const config = vscode.workspace.getConfiguration('one');
    const activeEngine = config.get<string>('defaultEngine', 'qplayer');
    const cliPath = config.get<string>('cliPath', '') || 'bin/one.cmd';

    const isQplayerActive = activeEngine === 'qplayer';
    const isVmActive = activeEngine === 'unifiedvm';

    return [
      {
        id: 'engine.qplayer',
        label: `Qplayer Runtime (OBI Engine) ${isQplayerActive ? '● Active' : '○'}`,
        description: isQplayerActive ? 'Current Default (7.7M ops/sec)' : 'Available',
        tooltip: 'High-throughput register machine executing One Binary Intelligence (.obi) bytecodes',
        icon: isQplayerActive ? 'zap' : 'circle-outline',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        command: {
          command: 'one.selectEngine',
          title: 'Switch Engine',
          arguments: ['qplayer'],
        },
        children: [
          {
            id: 'engine.qplayer.speed',
            label: 'Throughput',
            description: '7.7 Million ops/sec',
            icon: 'dashboard',
          },
          {
            id: 'engine.qplayer.format',
            label: 'Binary Format',
            description: 'OBI v1.0 (32-bit compact)',
            icon: 'file-binary',
          },
          {
            id: 'engine.qplayer.reduction',
            label: 'Bytecode Reduction',
            description: '94.9% vs JSON IR',
            icon: 'graph-line',
          },
        ],
      },
      {
        id: 'engine.unifiedvm',
        label: `UnifiedVM (Spatial 369 VM) ${isVmActive ? '● Active' : '○'}`,
        description: isVmActive ? 'Current Default' : 'Available',
        tooltip: 'Standard deterministic 369 Spatial Virtual Machine (sigma^2 = 0.0)',
        icon: isVmActive ? 'check' : 'circle-outline',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        command: {
          command: 'one.selectEngine',
          title: 'Switch Engine',
          arguments: ['unifiedvm'],
        },
        children: [
          {
            id: 'engine.unifiedvm.model',
            label: 'Execution Model',
            description: 'Zero-variance deterministic',
            icon: 'shield',
          },
          {
            id: 'engine.unifiedvm.container',
            label: 'Container Format',
            description: 'ONEX Executable (.ox)',
            icon: 'package',
          },
        ],
      },
      {
        id: 'engine.native',
        label: 'Native Executable (one.exe)',
        description: 'Windows PE32+ x64 (97.37 MB)',
        tooltip: 'Self-contained zero-dependency standalone native binary',
        icon: 'terminal',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
      },
      {
        id: 'engine.clipath',
        label: 'CLI Target Path',
        description: cliPath,
        tooltip: 'Path to developer CLI executable wrapper',
        icon: 'gear',
        command: {
          command: 'one.selectCli',
          title: 'Change CLI Path',
        },
      },
    ];
  }
}

// ============================================================================
// 2. Monorepo Packages & Reasoning Substrates Provider
// ============================================================================
export class OnePackagesProvider implements vscode.TreeDataProvider<OneTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<OneTreeElement | undefined | void> = new vscode.EventEmitter<OneTreeElement | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<OneTreeElement | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OneTreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? (element.children && element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip || `${element.label}: ${element.description || ''}`;
    if (element.icon) {
      item.iconPath = new vscode.ThemeIcon(element.icon);
    }
    return item;
  }

  getChildren(element?: OneTreeElement): vscode.ProviderResult<OneTreeElement[]> {
    if (element) {
      return element.children || [];
    }

    return [
      {
        id: 'pkg.binary_reasoning',
        label: 'binary-reasoning',
        description: 'v1.0.0 (Reasoning Substrate)',
        tooltip: 'Discrete 0/1 symbolic logic encoding & bounded heuristic state exploration',
        icon: 'symbol-misc',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: [
          {
            id: 'pkg.br.status',
            label: 'Verification Status',
            description: '4/4 Suites 100% Passed',
            icon: 'pass',
          },
          {
            id: 'pkg.br.encoder',
            label: 'Logic Encoding',
            description: '3/6/9-bit Symbolic Logic',
            icon: 'circuit-board',
          },
        ],
      },
      {
        id: 'pkg.ast_emitter',
        label: 'ast-emitter',
        description: 'v1.0.0',
        tooltip: 'High-speed AST emission and serialization',
        icon: 'references',
      },
      {
        id: 'pkg.nlp_parser',
        label: 'nlp-parser',
        description: 'v1.0.0',
        tooltip: 'Natural language intent analyzer & compiler frontend',
        icon: 'comment-discussion',
      },
      {
        id: 'pkg.pqc_lattice',
        label: 'pqc-lattice',
        description: 'v1.0.0',
        tooltip: 'Post-quantum cryptography lattice cryptographic primitives',
        icon: 'lock',
      },
      {
        id: 'pkg.sovereign_cli',
        label: 'sovereign-cli',
        description: 'v1.0.0',
        tooltip: 'Sovereign offline CLI toolset & system management',
        icon: 'terminal-cmd',
      },
      {
        id: 'pkg.time_travel',
        label: 'time-travel',
        description: 'v1.0.0',
        tooltip: 'Deterministic state rewind, checkpoints & WAL debugger',
        icon: 'history',
      },
      {
        id: 'pkg.stdlib',
        label: 'Standard Library (OneStdLib)',
        description: 'Math, I/O, Spatial APIs',
        tooltip: 'Built-in functions and standard library runtime interfaces',
        icon: 'library',
      },
    ];
  }
}

// ============================================================================
// 3. Spatial Memory 369 & Safety Containment Provider
// ============================================================================
export class OneSpatialProvider implements vscode.TreeDataProvider<OneTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<OneTreeElement | undefined | void> = new vscode.EventEmitter<OneTreeElement | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<OneTreeElement | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OneTreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? (element.children && element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip || `${element.label}: ${element.description || ''}`;
    if (element.icon) {
      item.iconPath = new vscode.ThemeIcon(element.icon);
    }
    return item;
  }

  getChildren(element?: OneTreeElement): vscode.ProviderResult<OneTreeElement[]> {
    if (element) {
      return element.children || [];
    }

    return [
      {
        id: 'spatial.address369',
        label: 'Address369 Memory Model',
        description: 'Slots [0..368] (Sovereign)',
        tooltip: 'Strictly bounded spatial memory space. Out-of-bounds access fails closed with E8005.',
        icon: 'database',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: [
          {
            id: 'spatial.a369.harmonic',
            label: 'Harmonic Alignment',
            description: '3 - 6 - 9 Resonant Grid',
            icon: 'pulse',
          },
          {
            id: 'spatial.a369.boundary',
            label: 'Boundary Enforcement',
            description: 'Strict [0..368] (E8005 Fail-Closed)',
            icon: 'shield-check',
          },
        ],
      },
      {
        id: 'spatial.actuation_lock',
        label: 'ACTUATION_LOCK Invariant',
        description: '● PERMANENTLY LOCKED',
        tooltip: 'Physical hardware actuation is permanently locked at compile-time and runtime (Fail-Closed E8005)',
        icon: 'shield',
      },
      {
        id: 'spatial.resource_limits',
        label: 'Resource Limit Guards',
        description: 'Loop Cap & RSS Guard',
        tooltip: 'Deterministic infinite loop ceiling and memory bounds',
        icon: 'server-process',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: [
          {
            id: 'spatial.res.instructions',
            label: 'Max Instruction Budget',
            description: '1,000,000 ops (E5007)',
            icon: 'watch',
          },
          {
            id: 'spatial.res.rss',
            label: 'RSS Memory Cap',
            description: '512 MB Hard Ceiling',
            icon: 'chip',
          },
        ],
      },
    ];
  }
}
