// Run all four algorithms on one workload and pick a winner (brief §5.4; PLAN §3.1).
import { runSimulation } from './simulate';
import { validateWorkload } from './validate';
import { ALGORITHM_LABEL, ALGORITHMS } from './types';
import type { AlgorithmId, CompareOutcome, CompareResult, Process, RunResult, Settings } from './types';

const fmt = (n: number): string => n.toFixed(2);

function verdict(runs: Record<AlgorithmId, RunResult>, winner: AlgorithmId, runnerUp: AlgorithmId): string {
  const w = runs[winner];
  const r = runs[runnerUp];
  const head =
    `${ALGORITHM_LABEL[winner]} wins with an average wait of ${fmt(w.averages.waiting)}, ` +
    `ahead of ${ALGORITHM_LABEL[runnerUp]} (${fmt(r.averages.waiting)})`;
  let worst = w.perProcess[0];
  for (const p of w.perProcess) if (p.waiting > worst.waiting) worst = p;
  if (worst.waiting === 0) return `${head}, and no process has to wait at all.`;
  const name = w.processes.find((p) => p.pid === worst.pid)?.name ?? `P${worst.pid}`;
  return `${head}, but ${name} waits longest under it (${worst.waiting} ticks).`;
}

/** Runs the four algorithms on an already validated workload. */
export function runComparison(processes: Process[], settings: Settings): CompareResult {
  const runs = {} as Record<AlgorithmId, RunResult>;
  for (const a of ALGORITHMS) runs[a] = runSimulation(processes, { ...settings, algorithm: a });
  // Stable sort keeps the fixed tie order fcfs, sjf, priority, rr.
  const ranked = [...ALGORITHMS].sort((a, b) => runs[a].averages.waiting - runs[b].averages.waiting);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  return { runs, winner, runnerUp, reason: verdict(runs, winner, runnerUp) };
}

/** Public entry point: validates first and never throws. */
export function compareAll(processes: Process[], settings: Settings): CompareOutcome {
  const v = validateWorkload(processes, settings);
  if (!v.ok) return v;
  return { ok: true, result: runComparison(processes, settings) };
}
