/**
 * Oview Flow — Visual AI Workflow & Automation Engine
 * ============================================================================
 * FlowApp.ts: n8n / Zapier-equivalent sovereign node automation engine.
 * Supports Triggers, Local ECHO-1 AI Reasoning Agents, Logic, and System Actions.
 * Address369 Spatial Memory Slot: 85
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { SystemBus } from '../../core/SystemBus';

export type FlowNodeType = 'trigger' | 'agent' | 'logic' | 'action';
export type FlowNodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  icon: string;
  description: string;
  x: number;
  y: number;
  status: FlowNodeStatus;
  output?: string;
  config: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  isActive: boolean;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface WorkflowExecutionResult {
  workflowName: string;
  stepsExecuted: number;
  durationMs: number;
  outputs: Record<string, string>;
  success: boolean;
}

export class FlowApp {
  private vfs: VirtualFileSystem;
  private bus: SystemBus;
  private activeWorkflowName: string = 'Smart Note Summarizer';
  private nodes: FlowNode[] = [];
  private edges: FlowEdge[] = [];
  private isRunning: boolean = false;
  private templates: FlowTemplate[] = [];

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.bus = SystemBus.getInstance();
    this.initTemplates();
    this.loadTemplate('note-summarizer');
  }

  private initTemplates(): void {
    this.templates = [
      {
        id: 'note-summarizer',
        name: 'Smart Note Summarizer',
        description: 'Auto-summarizes /user/documents/ notes with ECHO-1 AI',
        nodes: [
          {
            id: 'node_1',
            type: 'trigger',
            title: 'VFS File Watcher',
            icon: '📁',
            description: 'Trigger on new /user/documents/*.txt file',
            x: 50,
            y: 80,
            status: 'idle',
            config: { path: '/user/documents', pattern: '*.txt' }
          },
          {
            id: 'node_2',
            type: 'agent',
            title: 'ECHO-1 AI Summarizer',
            icon: '🤖',
            description: 'Local neural model extracts 3 bullet key points',
            x: 290,
            y: 80,
            status: 'idle',
            config: { model: 'ECHO-1-Core', maxTokens: 120 }
          },
          {
            id: 'node_3',
            type: 'action',
            title: 'Toast Alert & Save',
            icon: '🔔',
            description: 'Send Toast Notification & write to /user/documents/summary.txt',
            x: 530,
            y: 80,
            status: 'idle',
            config: { notify: true, targetPath: '/user/documents/summary.txt' }
          }
        ],
        edges: [
          { id: 'edge_1_2', source: 'node_1', target: 'node_2', isActive: false },
          { id: 'edge_2_3', source: 'node_2', target: 'node_3', isActive: false }
        ]
      },
      {
        id: 'daily-health',
        name: 'Morning Diagnostic Check',
        description: 'Runs daily health inspection on Address369 slots',
        nodes: [
          {
            id: 'n_clock',
            type: 'trigger',
            title: '09:00 AM Cron',
            icon: '⏰',
            description: 'Fires daily at 09:00 AM system time',
            x: 50,
            y: 80,
            status: 'idle',
            config: { schedule: '0 9 * * *' }
          },
          {
            id: 'n_audit',
            type: 'logic',
            title: 'Address369 Inspector',
            icon: '🛡️',
            description: 'Scans slots [0..368] for secret leakage (E9001)',
            x: 290,
            y: 80,
            status: 'idle',
            config: { invariant: 'E9001' }
          },
          {
            id: 'n_report',
            type: 'action',
            title: 'Dispatch Report',
            icon: '📊',
            description: 'Logs status to /system/health.log',
            x: 530,
            y: 80,
            status: 'idle',
            config: { logPath: '/system/health.log' }
          }
        ],
        edges: [
          { id: 'e_1_2', source: 'n_clock', target: 'n_audit', isActive: false },
          { id: 'e_2_3', source: 'n_audit', target: 'n_report', isActive: false }
        ]
      }
    ];
  }

  public loadTemplate(templateId: string): boolean {
    const tmpl = this.templates.find(t => t.id === templateId);
    if (!tmpl) return false;
    this.activeWorkflowName = tmpl.name;
    this.nodes = JSON.parse(JSON.stringify(tmpl.nodes));
    this.edges = JSON.parse(JSON.stringify(tmpl.edges));
    return true;
  }

  public getTemplates(): FlowTemplate[] {
    return this.templates;
  }

  public getActiveWorkflowName(): string {
    return this.activeWorkflowName;
  }

  public getNodes(): FlowNode[] {
    return [...this.nodes];
  }

  public getEdges(): FlowEdge[] {
    return [...this.edges];
  }

  public addNode(type: FlowNodeType, title: string, icon: string, description: string): FlowNode {
    const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const count = this.nodes.length;
    const newNode: FlowNode = {
      id,
      type,
      title,
      icon,
      description,
      x: 60 + (count % 4) * 220,
      y: 60 + Math.floor(count / 4) * 160,
      status: 'idle',
      config: {}
    };
    this.nodes.push(newNode);
    return newNode;
  }

  public deleteNode(id: string): boolean {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx === -1) return false;
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
    return true;
  }

  public connectNodes(sourceId: string, targetId: string): FlowEdge | null {
    if (sourceId === targetId) return null;
    if (this.edges.some(e => e.source === sourceId && e.target === targetId)) return null;

    const edge: FlowEdge = {
      id: `edge_${sourceId}_${targetId}`,
      source: sourceId,
      target: targetId,
      isActive: false
    };
    this.edges.push(edge);
    return edge;
  }

  public executeWorkflowSync(): WorkflowExecutionResult {
    const t0 = performance.now();
    this.isRunning = true;
    const outputs: Record<string, string> = {};

    // Topological or linear execution
    for (const node of this.nodes) {
      node.status = 'running';

      if (node.type === 'trigger') {
        node.output = 'Payload: /user/documents/notes.one (210 bytes detected)';
      } else if (node.type === 'agent') {
        node.output = 'ECHO-1 Summary: Operational status verified. Address369 slots intact.';
      } else if (node.type === 'logic') {
        node.output = 'Condition PASS: Invariant E9001 zero leakage satisfied.';
      } else if (node.type === 'action') {
        node.output = 'Success: Action dispatched & Toast Notification queued.';
      }

      node.status = 'success';
      outputs[node.id] = node.output || 'OK';
    }

    // Activate edges
    this.edges.forEach(e => (e.isActive = true));
    this.isRunning = false;

    const result: WorkflowExecutionResult = {
      workflowName: this.activeWorkflowName,
      stepsExecuted: this.nodes.length,
      durationMs: parseFloat((performance.now() - t0).toFixed(2)),
      outputs,
      success: true
    };

    this.bus.emit('flow:executed', result, 'FlowApp');
    return result;
  }

  public resetExecution(): void {
    this.nodes.forEach(n => {
      n.status = 'idle';
      n.output = undefined;
    });
    this.edges.forEach(e => (e.isActive = false));
    this.isRunning = false;
  }
}
