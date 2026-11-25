import { describe, expect, it } from 'vitest';
import { presets, randomWorkload } from '../engine';
import type { Settings } from '../engine/types';
import { decodeShare, encodeShare } from './share';

const DEFAULTS: Settings = { algorithm: 'fcfs', quantum: 2, preemptive: false, lowerIsHigherPriority: true };
const strip = (ps: { arrival: number; burst: number; priority: number }[]) => ps.map(({ arrival, burst, priority }) => ({ arrival, burst, priority }));

describe('share links', () => {
  it('round-trips every preset and random workloads with every setting', () => {
    const workloads = [...presets.map((p) => p.processes), ...[1, 2, 3].map((s) => randomWorkload(s, 12))];
    const settings: Settings[] = [
      DEFAULTS,
      { algorithm: 'rr', quantum: 5, preemptive: false, lowerIsHigherPriority: false },
      { algorithm: 'sjf', quantum: 1, preemptive: true, lowerIsHigherPriority: true },
    ];
    for (const processes of workloads) {
      for (const s of settings) {
        const back = decodeShare('#' + encodeShare({ processes, settings: s }), DEFAULTS);
        expect(back).not.toBeNull();
        expect(strip(back!.processes)).toEqual(strip(processes));
        expect(back!.settings).toEqual(s);
        expect(back!.processes.map((p) => p.pid)).toEqual(processes.map((_, i) => i + 1));
      }
    }
  });

  it('produces a short, readable fragment', () => {
    const hash = encodeShare({ processes: presets[0]!.processes.slice(0, 2), settings: DEFAULTS });
    expect(hash).toMatch(/^w=\d+\.\d+\.-?\d+,\d+\.\d+\.-?\d+&a=fcfs&q=2&p=0&h=1$/);
  });

  it('keeps negative priorities and leaves range checks to the engine', () => {
    const back = decodeShare('w=0.0.-3', DEFAULTS);
    expect(back?.processes[0]).toMatchObject({ arrival: 0, burst: 0, priority: -3 });
  });

  it('falls back to defaults for missing or unknown settings', () => {
    expect(decodeShare('w=0.3.1&a=lottery&q=x&p=maybe', DEFAULTS)?.settings).toEqual(DEFAULTS);
  });

  it('rejects malformed hashes instead of guessing', () => {
    for (const bad of ['', '#', 'a=rr', 'w=', 'w=1.2', 'w=1.2.3.4', 'w=1.x.3', 'w=1.5e3.2', 'w=0.1.1,,0.2.1', `w=${Array(65).fill('0.1.1').join(',')}`]) {
      expect(decodeShare(bad, DEFAULTS), bad).toBeNull();
    }
  });
});
