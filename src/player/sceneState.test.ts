import { describe, expect, it } from 'vitest';
import { compareAll, presets, randomWorkload } from '../engine';
import { ALGORITHMS, type Process, type RunResult, type Settings } from '../engine/types';
import { buildPlan, playheadAt, settledPoseAt } from './keyframes';
import { chipFrameAt, coreFrameAt, planEndSec, remainingAt } from './sceneState';

const BASE: Settings = { algorithm: 'fcfs', quantum: 2, preemptive: false, lowerIsHigherPriority: true };

function runsFor(processes: Process[], preemptive = false): RunResult[] {
  const out = compareAll(processes, { ...BASE, preemptive });
  if (!out.ok) throw new Error('invalid workload in test');
  return ALGORITHMS.map((a) => out.result.runs[a]);
}

const workloads: Process[][] = [
  ...presets.map((p) => p.processes),
  ...[1, 2, 3, 4, 5].map((seed) => randomWorkload(seed, 8)),
];
const runs: RunResult[] = workloads.flatMap((w) => [...runsFor(w), ...runsFor(w, true)]);

describe('replay plan', () => {
  it('animates dispatches in exactly the engine order', () => {
    for (const run of runs) {
      const plan = buildPlan(run);
      const animated = plan.dispatches.map((d) => d.pid);
      const engine = run.events.filter((e) => e.type === 'DISPATCH').map((e) => e.pid);
      expect(animated).toEqual(engine);
    }
  });

  it('is a pure function of time: scrubbing in any order gives the same poses', () => {
    for (const run of runs.slice(0, 12)) {
      const plan = buildPlan(run);
      const end = planEndSec(plan);
      const times = Array.from({ length: 40 }, (_, i) => (end * ((i * 7919) % 40)) / 40);
      const forward = [...times].sort((a, b) => a - b).map((t) => run.processes.map((p) => chipFrameAt(plan, p.pid, t).pose));
      const shuffled = new Map(times.map((t) => [t, run.processes.map((p) => chipFrameAt(plan, p.pid, t).pose)]));
      [...times].sort((a, b) => a - b).forEach((t, i) => expect(shuffled.get(t)).toEqual(forward[i]));
    }
  });

  it('agrees with the settled keyframes whenever a chip is at rest', () => {
    for (const run of runs.slice(0, 12)) {
      const plan = buildPlan(run);
      const end = planEndSec(plan);
      for (let k = 0; k <= 60; k++) {
        const sec = (end * k) / 60;
        for (const p of run.processes) {
          const settled = settledPoseAt(plan, p.pid, sec);
          const f = chipFrameAt(plan, p.pid, sec);
          if (settled && !f.move) expect(f.pose).toEqual(settled);
        }
      }
    }
  });

  it('retires every chip by the end of the timeline', () => {
    for (const run of runs) {
      const plan = buildPlan(run);
      const end = planEndSec(plan);
      for (const p of run.processes) expect(chipFrameAt(plan, p.pid, end).pose.opacity).toBe(0);
    }
  });
});

describe('readouts folded from the engine output', () => {
  it('remaining burst falls to zero at completion and matches the core ring', () => {
    for (const run of runs) {
      for (const r of run.perProcess) expect(remainingAt(run, r.pid, r.completion)).toBe(0);
      for (const seg of run.segments) {
        if (seg.pid === null) continue;
        const f = coreFrameAt(run, seg.start, run.settings.quantum);
        const burst = run.processes.find((p) => p.pid === seg.pid)!.burst;
        expect(f.segment?.pid).toBe(seg.pid);
        expect(f.remainingFrac).toBeCloseTo(remainingAt(run, seg.pid, seg.start) / burst, 9);
      }
    }
  });

  it('playhead context-switch count ends at the engine total', () => {
    for (const run of runs) {
      const last = run.events[run.events.length - 1]?.time ?? 0;
      expect(playheadAt(run, last).contextSwitches).toBe(run.contextSwitches);
    }
  });
});
