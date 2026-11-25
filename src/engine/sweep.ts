// Quantum sweep (brief §13 stretch goal 2): how Round Robin's averages change with the quantum.
import { runSimulation } from './simulate';
import { validateWorkload } from './validate';
import type { Process, Settings, ValidationError } from './types';

export interface SweepPoint {
  quantum: number;
  waiting: number;
  turnaround: number;
  response: number;
  contextSwitches: number;
}

export interface SweepResult {
  points: SweepPoint[];
  /** Lowest average wait; ties go to fewer context switches, then the smaller quantum. */
  best: SweepPoint;
  /**
   * From this quantum on, every slice finishes its process, so Round Robin is exactly FCFS.
   * Equal to the longest burst; the sweep stops here because larger quanta change nothing.
   */
  fcfsFrom: number;
}

export type SweepOutcome = { ok: true; result: SweepResult } | { ok: false; errors: ValidationError[] };

/** Runs Round Robin for every quantum from 1 to the longest burst. Validates first and never throws. */
export function quantumSweep(processes: Process[], settings: Settings): SweepOutcome {
  const v = validateWorkload(processes, settings);
  if (!v.ok) return v;
  const fcfsFrom = Math.max(...processes.map((p) => p.burst));
  const points: SweepPoint[] = [];
  for (let quantum = 1; quantum <= fcfsFrom; quantum++) {
    const run = runSimulation(processes, { ...settings, algorithm: 'rr', quantum });
    points.push({ quantum, ...run.averages, contextSwitches: run.contextSwitches });
  }
  let best = points[0]!;
  for (const p of points) {
    if (p.waiting < best.waiting - 1e-9 || (Math.abs(p.waiting - best.waiting) <= 1e-9 && p.contextSwitches < best.contextSwitches)) best = p;
  }
  return { ok: true, result: { points, best, fcfsFrom } };
}
