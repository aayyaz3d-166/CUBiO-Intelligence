/**
 * CUBiO AI — ONE LANGUAGE — WORKER IPC PROTOCOL
 * ===============================================
 * Module: @one/workers/WorkerProtocol
 * Gate: ONE-06 / Worker Parallelism Protocol & Messages
 *
 * Defines strictly-typed message contracts for communication between the
 * master orchestration thread and worker threads.
 */

import { SharedArenaLayout } from './SharedMemoryArena';

export type WorkerTaskType =
  | 'INIT'
  | 'BATCH'
  | 'EPISODE'
  | 'TENSOR_CHUNK'
  | 'PING'
  | 'SHUTDOWN';

export interface WorkerInitMessage {
  type: 'INIT';
  workerId: number;
  totalWorkers: number;
  sab: SharedArrayBuffer;
  layout: SharedArenaLayout;
  seed: number;
}

export interface TrainingBatchData {
  tokens: number[];
  targetSpatialState: Float32Array | number[];
  referenceLogits: Float32Array | number[];
}

export interface WorkerBatchTaskMessage {
  type: 'BATCH';
  taskId: string;
  sequence: number; // Deterministic 369-harmonic sequence order
  batch: TrainingBatchData;
  learningRate?: number;
}

export interface WorkerEpisodeTaskMessage {
  type: 'EPISODE';
  taskId: string;
  sequence: number;
  steps: number;
  seed: number;
}

export interface WorkerTensorChunkMessage {
  type: 'TENSOR_CHUNK';
  taskId: string;
  sequence: number;
  op: 'matmul' | 'reduce_sum' | 'add';
  // Matmul slice parameters
  rowStart: number;
  rowEnd: number;
  M: number;
  K: number;
  N: number;
  offsetA: number;
  offsetB: number;
  offsetC: number;
}

export interface WorkerShutdownMessage {
  type: 'SHUTDOWN';
}

export interface WorkerPingMessage {
  type: 'PING';
  timestamp: number;
  taskId?: string;
  sequence?: number;
}

export type MasterToWorkerMessage =
  | WorkerInitMessage
  | WorkerBatchTaskMessage
  | WorkerEpisodeTaskMessage
  | WorkerTensorChunkMessage
  | WorkerShutdownMessage
  | WorkerPingMessage;

export interface WorkerResultMessage {
  type: 'RESULT';
  taskId: string;
  sequence: number;
  workerId: number;
  success: boolean;
  loss?: number;
  dpoDivergence?: number;
  gradientNorm?: number;
  checksum?: number;
  durationMs?: number;
  error?: string;
  // For tensor operations
  computedSum?: number;
  elementsProcessed?: number;
}

export interface WorkerPongMessage {
  type: 'PONG';
  workerId: number;
  timestamp: number;
  taskId?: string;
  sequence?: number;
  success?: boolean;
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  taskId?: string;
  workerId: number;
  error: string;
}

export type WorkerToMasterMessage =
  | WorkerResultMessage
  | WorkerPongMessage
  | WorkerErrorMessage;

export interface WorkerHealthRecord {
  workerId: number;
  isAlive: boolean;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  lastHeartbeatTime: number;
  currentTaskId: string | null;
  currentSequence: number | null;
}
