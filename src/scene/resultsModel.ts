// Pure presentation helpers for the results layer and the algorithm ring (no React, no DOM).
// They only format and place engine output; no scheduling is computed here.
import type { AlgorithmId, RunResult, Segment, Settings } from '../engine/types';

/** Readout format for averages: always two decimals. */
export function fmt2(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '--';
}

/** Short label on the algorithm selector buttons around the CPU. */
export function ringLabel(id: AlgorithmId, s: Pick<Settings, 'quantum' | 'preemptive'>): string {
  switch (id) {
    case 'fcfs':
      return 'FCFS';
    case 'sjf':
      return s.preemptive ? 'SRTF' : 'SJF';
    case 'priority':
      return s.preemptive ? 'P-PRE' : 'PRIO';
    case 'rr':
      return `RR q=${s.quantum}`;
  }
}

/** One-line mode description printed under the algorithm name on a mini-CPU die. */
export function modeLabel(id: AlgorithmId, s: Pick<Settings, 'quantum' | 'preemptive'>): string {
  if (id === 'rr') return `quantum ${s.quantum}`;
  if (id === 'sjf' && s.preemptive) return 'SRTF · preemptive';
  if (id === 'priority' && s.preemptive) return 'preemptive';
  return 'non-preemptive';
}

/** Plain-English rule for each algorithm, used by tooltips. */
export function algorithmExplanation(id: AlgorithmId, s: Pick<Settings, 'quantum' | 'preemptive'>): string {
  switch (id) {
    case 'fcfs':
      return 'FCFS runs jobs in arrival order; one long job can hold up everyone behind it.';
    case 'sjf':
      return s.preemptive
        ? 'SRTF always runs the job with the least time left, preempting when a shorter one arrives; long jobs can starve.'
        : 'SJF runs the shortest waiting job next, which keeps average wait low but can starve long jobs.';
    case 'priority':
      return s.preemptive
        ? 'Preemptive Priority runs the most important job and kicks it off when a more important one arrives.'
        : 'Priority runs the most important waiting job next; low-priority jobs can starve.';
    case 'rr':
      return `Round Robin gives each job ${s.quantum} tick${s.quantum === 1 ? '' : 's'} in turn: fair and responsive, at the cost of more context switches.`;
  }
}

/** Shared time axis so the four mini Gantt traces are drawn on the same scale. */
export function sharedTimeAxis(runs: readonly RunResult[]): { t0: number; span: number } {
  let t0 = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const r of runs) {
    for (const s of r.segments) {
      if (s.start < t0) t0 = s.start;
      if (s.end > end) end = s.end;
    }
  }
  if (!Number.isFinite(t0) || !Number.isFinite(end)) return { t0: 0, span: 0 };
  return { t0, span: end - t0 };
}

export interface GanttBlock {
  pid: number | null;
  x: number;
  width: number;
  start: number;
  end: number;
}

/** Maps segments onto a horizontal strip [x, x + width] for the time axis (t0, span). */
export function ganttBlocks(segments: readonly Segment[], t0: number, span: number, x: number, width: number): GanttBlock[] {
  if (span <= 0) return [];
  const k = width / span;
  return segments.map((s) => ({ pid: s.pid, start: s.start, end: s.end, x: x + (s.start - t0) * k, width: (s.end - s.start) * k }));
}
