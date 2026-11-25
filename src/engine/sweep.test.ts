import { describe, expect, it } from 'vitest';
import { presets, quantumSweep, randomWorkload, simulate } from './index';
import type { Settings } from './types';

const SETTINGS: Settings = { algorithm: 'fcfs', quantum: 2, preemptive: false, lowerIsHigherPriority: true };

describe('quantumSweep', () => {
  it('covers quanta 1..longest burst and matches individual RR runs', () => {
    for (const processes of [...presets.map((p) => p.processes), randomWorkload(9, 10)]) {
      const out = quantumSweep(processes, SETTINGS);
      if (!out.ok) throw new Error('invalid workload in test');
      const longest = Math.max(...processes.map((p) => p.burst));
      expect(out.result.fcfsFrom).toBe(longest);
      expect(out.result.points.map((p) => p.quantum)).toEqual(Array.from({ length: longest }, (_, i) => i + 1));
      for (const pt of out.result.points) {
        const run = simulate(processes, { ...SETTINGS, algorithm: 'rr', quantum: pt.quantum });
        if (!run.ok) throw new Error('unreachable');
        expect(pt.waiting).toBe(run.result.averages.waiting);
        expect(pt.contextSwitches).toBe(run.result.contextSwitches);
      }
    }
  });

  it('the last point equals FCFS', () => {
    const processes = presets[0]!.processes;
    const out = quantumSweep(processes, SETTINGS);
    const fcfs = simulate(processes, SETTINGS);
    if (!out.ok || !fcfs.ok) throw new Error('invalid workload in test');
    expect(out.result.points.at(-1)!.waiting).toBe(fcfs.result.averages.waiting);
  });

  it('best has the minimum wait, breaking ties by fewer context switches', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const out = quantumSweep(randomWorkload(seed, 8), SETTINGS);
      if (!out.ok) throw new Error('invalid workload in test');
      const { points, best } = out.result;
      const min = Math.min(...points.map((p) => p.waiting));
      expect(best.waiting).toBeCloseTo(min, 9);
      const tied = points.filter((p) => Math.abs(p.waiting - min) <= 1e-9);
      expect(best.contextSwitches).toBe(Math.min(...tied.map((p) => p.contextSwitches)));
    }
  });

  it('returns errors instead of throwing on invalid input', () => {
    const out = quantumSweep([], SETTINGS);
    expect(out.ok).toBe(false);
  });
});
