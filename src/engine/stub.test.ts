import { describe, expect, it } from 'vitest';
import sample from '../data/sample-result.json';
import type { RunResult } from './types';

// Sanity checks on the hand-made sample (WP-A turns it into a golden test against simulate()).
describe('sample-result.json', () => {
  const r = sample as RunResult;
  it('segments cover every burst exactly', () => {
    for (const p of r.processes) {
      const ran = r.segments.filter((s) => s.pid === p.pid).reduce((a, s) => a + s.end - s.start, 0);
      expect(ran).toBe(p.burst);
    }
  });
  it('metric invariants hold', () => {
    for (const pr of r.perProcess) {
      const p = r.processes.find((x) => x.pid === pr.pid)!;
      expect(pr.turnaround).toBe(pr.completion - p.arrival);
      expect(pr.waiting).toBe(pr.turnaround - p.burst);
    }
  });
  it('dispatch order equals segment order', () => {
    const d = r.events.filter((e) => e.type === 'DISPATCH').map((e) => e.pid);
    expect(d).toEqual(r.segments.filter((s) => s.pid !== null).map((s) => s.pid));
  });
});
