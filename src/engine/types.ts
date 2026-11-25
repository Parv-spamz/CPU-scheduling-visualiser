// LOCKED CONTRACT (brief §5.1). Change only through the lead; see PLAN.md §3.

export type AlgorithmId = 'fcfs' | 'sjf' | 'priority' | 'rr';

export const ALGORITHMS: readonly AlgorithmId[] = ['fcfs', 'sjf', 'priority', 'rr'];

export interface Process {
  pid: number; // unique, 1-based
  name: string; // 'P1', 'P2', ...
  arrival: number; // integer >= 0
  burst: number; // integer >= 1
  priority: number; // integer; lower = more important by default
  color: string; // stable per pid, from the theme palette
}

export interface Settings {
  algorithm: AlgorithmId;
  quantum: number; // Round Robin only, integer >= 1
  preemptive: boolean; // SJF (becomes SRTF) and Priority only
  lowerIsHigherPriority: boolean; // default true
}

export interface Workload {
  processes: Process[];
  settings: Settings;
}

export interface Segment {
  pid: number | null; // null = CPU idle
  start: number;
  end: number;
}

export type EventType =
  | 'ARRIVE'
  | 'ENQUEUE'
  | 'DISPATCH'
  | 'RUN'
  | 'PREEMPT'
  | 'CONTEXT_SWITCH'
  | 'IDLE'
  | 'COMPLETE';

/** Ordering of events that share the same time (brief §5.2a). */
export const EVENT_RANK: Record<EventType, number> = {
  COMPLETE: 0,
  PREEMPT: 1,
  ARRIVE: 2,
  ENQUEUE: 3,
  CONTEXT_SWITCH: 4,
  DISPATCH: 5,
  RUN: 6,
  IDLE: 7,
};

export interface SimEvent {
  time: number;
  type: EventType;
  pid: number | null;
  duration?: number; // RUN and IDLE only
  remaining?: number; // burst left after this event, for the pid
  queue: number[]; // ready-queue pids, front first, AFTER this event
  note?: string; // one-line reason for the scheduler block
}

export interface ProcessResult {
  pid: number;
  completion: number;
  turnaround: number;
  waiting: number;
  response: number;
}

export interface RunResult {
  algorithm: AlgorithmId;
  settings: Settings;
  processes: Process[];
  segments: Segment[];
  events: SimEvent[];
  perProcess: ProcessResult[];
  averages: { waiting: number; turnaround: number; response: number };
  utilisation: number; // busy time / makespan, 0..1
  throughput: number; // processes / makespan
  contextSwitches: number;
  idleTime: number;
  makespan: number; // last completion minus earliest arrival
}

export interface CompareResult {
  runs: Record<AlgorithmId, RunResult>;
  winner: AlgorithmId; // lowest average waiting time
  runnerUp: AlgorithmId;
  reason: string; // one plain-English sentence that names the trade-off
}

export interface ValidationError {
  field: 'workload' | 'arrival' | 'burst' | 'priority' | 'pid' | 'quantum';
  pid: number | null;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

export type SimulateOutcome = { ok: true; result: RunResult } | { ok: false; errors: ValidationError[] };
export type CompareOutcome = { ok: true; result: CompareResult } | { ok: false; errors: ValidationError[] };

export const ALGORITHM_LABEL: Record<AlgorithmId, string> = {
  fcfs: 'FCFS',
  sjf: 'SJF',
  priority: 'Priority',
  rr: 'Round Robin',
};
