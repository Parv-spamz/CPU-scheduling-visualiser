import type { Process, RunResult } from '../../engine/types';
import { remainingAt } from '../../player/sceneState';

/** One-line description of a process at simulation time t (used by hover and click). */
export function describeProcess(run: RunResult, p: Process, t: number): string {
  const rem = remainingAt(run, p.pid, t);
  const base = `${p.name}: arrival ${p.arrival}, burst ${p.burst}, priority ${p.priority}, remaining ${rem}`;
  const r = run.perProcess.find((x) => x.pid === p.pid);
  if (r && t >= r.completion) return `${base}. Finished at ${r.completion}: waited ${r.waiting}, turnaround ${r.turnaround}, response ${r.response}.`;
  return `${base}.`;
}
