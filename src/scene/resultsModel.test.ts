import { describe, expect, it } from 'vitest';
import { compareAll, presets } from '../engine';
import type { Settings } from '../engine/types';
import { fmt2, ganttBlocks, modeLabel, ringLabel, sharedTimeAxis } from './resultsModel';

const BASE: Settings = { algorithm: 'fcfs', quantum: 3, preemptive: false, lowerIsHigherPriority: true };

describe('fmt2', () => {
  it('always prints two decimals', () => {
    expect(fmt2(4.666666)).toBe('4.67');
    expect(fmt2(2)).toBe('2.00');
    expect(fmt2(0)).toBe('0.00');
    expect(fmt2(Number.NaN)).toBe('--');
  });
});

describe('ring and mode labels', () => {
  it('names the non-preemptive selectors and shows the quantum on RR', () => {
    expect(['fcfs', 'sjf', 'priority', 'rr'].map((id) => ringLabel(id as Settings['algorithm'], BASE))).toEqual([
      'FCFS',
      'SJF',
      'PRIO',
      'RR q=3',
    ]);
  });
  it('switches SJF and Priority to their preemptive names', () => {
    const pre = { ...BASE, preemptive: true };
    expect(ringLabel('sjf', pre)).toBe('SRTF');
    expect(ringLabel('priority', pre)).toBe('P-PRE');
    expect(ringLabel('fcfs', pre)).toBe('FCFS');
    expect(modeLabel('sjf', pre)).toBe('SRTF · preemptive');
    expect(modeLabel('rr', pre)).toBe('quantum 3');
  });
});

describe('mini Gantt geometry', () => {
  it('maps segments onto the strip, contiguous and filling the width', () => {
    const segs = [
      { pid: 1, start: 2, end: 5 },
      { pid: null, start: 5, end: 6 },
      { pid: 2, start: 6, end: 12 },
    ];
    const blocks = ganttBlocks(segs, 2, 10, 100, 500);
    expect(blocks.map((b) => [b.x, b.width])).toEqual([
      [100, 150],
      [250, 50],
      [300, 300],
    ]);
    expect(blocks[1].pid).toBeNull();
  });

  it('returns nothing for an empty time axis', () => {
    expect(ganttBlocks([{ pid: 1, start: 0, end: 0 }], 0, 0, 0, 100)).toEqual([]);
    expect(sharedTimeAxis([])).toEqual({ t0: 0, span: 0 });
  });

  it('puts all four engine runs of every preset on one axis that covers each run', () => {
    for (const preset of presets) {
      const cmp = compareAll(preset.processes, BASE);
      expect(cmp.ok).toBe(true);
      if (!cmp.ok) continue;
      const runs = Object.values(cmp.result.runs);
      const { t0, span } = sharedTimeAxis(runs);
      for (const r of runs) {
        const blocks = ganttBlocks(r.segments, t0, span, 0, 1000);
        const first = blocks[0];
        const last = blocks[blocks.length - 1];
        expect(first.x).toBeGreaterThanOrEqual(0);
        expect(last.x + last.width).toBeLessThanOrEqual(1000 + 1e-9);
      }
    }
  });
});
