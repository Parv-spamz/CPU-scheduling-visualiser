import { describe, expect, it } from 'vitest';
import sample from '../data/sample-result.json';
import { colorForPid } from '../theme/palette';
import { compareAll, presets, randomWorkload, simulate, toCsv, validateWorkload } from './index';
import { priorityKey } from './algorithms';
import { EVENT_RANK, ALGORITHMS } from './types';
import type { AlgorithmId, Process, RunResult, Segment, Settings } from './types';

// ---------- helpers ----------

/** Builds processes from [arrival, burst, priority?] rows; pids 1..n. */
function procs(rows: [number, number, number?][]): Process[] {
  return rows.map(([arrival, burst, priority], i) => ({
    pid: i + 1,
    name: `P${i + 1}`,
    arrival,
    burst,
    priority: priority ?? 1,
    color: colorForPid(i + 1),
  }));
}

function settings(algorithm: AlgorithmId, extra: Partial<Settings> = {}): Settings {
  return { algorithm, quantum: 2, preemptive: false, lowerIsHigherPriority: true, ...extra };
}

function run(ps: Process[], s: Settings): RunResult {
  const out = simulate(ps, s);
  if (!out.ok) throw new Error(out.errors.map((e) => e.message).join('; '));
  return out.result;
}

/** Compact segment notation: [pid|null, start, end]. */
function segs(r: RunResult): [number | null, number, number][] {
  return r.segments.map((s) => [s.pid, s.start, s.end]);
}

function metric(r: RunResult, key: 'completion' | 'turnaround' | 'waiting' | 'response'): number[] {
  return r.perProcess.map((p) => p[key]);
}

/** Invariants that must hold for every run (brief §12). */
function checkInvariants(ps: Process[], r: RunResult): void {
  const byPid = new Map(ps.map((p) => [p.pid, p]));
  const earliest = Math.min(...ps.map((p) => p.arrival));

  // Segments are contiguous, never overlap, start at the earliest arrival, no leading idle.
  expect(r.segments[0].start).toBe(earliest);
  expect(r.segments[0].pid).not.toBeNull();
  const badSegments = r.segments.filter(
    (s, i) =>
      s.end <= s.start ||
      (i > 0 && s.start !== r.segments[i - 1].end) ||
      (s.pid !== null && s.start < byPid.get(s.pid)!.arrival),
  );
  expect(badSegments).toEqual([]);
  // Total run time per process equals its burst.
  for (const p of ps) {
    const ran = r.segments.filter((s) => s.pid === p.pid).reduce((a, s) => a + s.end - s.start, 0);
    expect(ran).toBe(p.burst);
  }
  // Metric identities.
  expect(r.perProcess.map((p) => p.pid)).toEqual([...ps].map((p) => p.pid).sort((a, b) => a - b));
  for (const pr of r.perProcess) {
    const p = byPid.get(pr.pid)!;
    const mine = r.segments.filter((s) => s.pid === p.pid);
    expect(pr.completion).toBe(mine[mine.length - 1].end);
    expect(pr.turnaround).toBe(pr.completion - p.arrival);
    expect(pr.waiting).toBe(pr.turnaround - p.burst);
    expect(pr.response).toBe(mine[0].start - p.arrival);
    expect(pr.response).toBeGreaterThanOrEqual(0);
    expect(pr.response).toBeLessThanOrEqual(pr.waiting);
  }
  const busy = r.segments.filter((s) => s.pid !== null).reduce((a, s) => a + s.end - s.start, 0);
  const idle = r.segments.filter((s) => s.pid === null).reduce((a, s) => a + s.end - s.start, 0);
  expect(r.idleTime).toBe(idle);
  expect(busy + idle).toBe(r.makespan);
  expect(r.makespan).toBe(Math.max(...r.perProcess.map((p) => p.completion)) - earliest);
  expect(r.utilisation).toBeCloseTo(busy / r.makespan, 12);
  expect(r.throughput).toBeCloseTo(ps.length / r.makespan, 12);
  const n = ps.length;
  expect(r.averages.waiting).toBeCloseTo(r.perProcess.reduce((a, p) => a + p.waiting, 0) / n, 12);
  expect(r.averages.turnaround).toBeCloseTo(r.perProcess.reduce((a, p) => a + p.turnaround, 0) / n, 12);
  expect(r.averages.response).toBeCloseTo(r.perProcess.reduce((a, p) => a + p.response, 0) / n, 12);

  // Events are sorted by (time, rank) and never go backwards.
  const unsorted = r.events.findIndex((b, i) => {
    if (i === 0) return false;
    const a = r.events[i - 1];
    return !(b.time > a.time || (b.time === a.time && EVENT_RANK[b.type] >= EVENT_RANK[a.type]));
  });
  expect(unsorted).toBe(-1);
  // DISPATCH order equals non-idle segment order; RUN mirrors each segment.
  const dispatches = r.events.filter((e) => e.type === 'DISPATCH');
  const work = r.segments.filter((s) => s.pid !== null);
  expect(dispatches.map((e) => [e.pid, e.time])).toEqual(work.map((s) => [s.pid, s.start]));
  const runs = r.events.filter((e) => e.type === 'RUN');
  expect(runs.map((e) => [e.pid, e.time, e.duration])).toEqual(work.map((s) => [s.pid, s.start, s.end - s.start]));
  const idles = r.events.filter((e) => e.type === 'IDLE');
  const idleSegs = r.segments.filter((s) => s.pid === null);
  expect(idles.map((e) => [e.time, e.duration])).toEqual(idleSegs.map((s) => [s.start, s.end - s.start]));
  // Every process arrives, is enqueued and completes exactly once, at the right time.
  for (const p of ps) {
    const arrive = r.events.filter((e) => e.type === 'ARRIVE' && e.pid === p.pid);
    expect(arrive.map((e) => e.time)).toEqual([p.arrival]);
    const done = r.events.filter((e) => e.type === 'COMPLETE' && e.pid === p.pid);
    expect(done.map((e) => e.time)).toEqual([r.perProcess.find((x) => x.pid === p.pid)!.completion]);
  }
  // Context switches: one per change of pid between consecutive non-idle segments.
  let expected = 0;
  for (let i = 1; i < work.length; i++) if (work[i].pid !== work[i - 1].pid) expected++;
  expect(r.contextSwitches).toBe(expected);
  expect(r.events.filter((e) => e.type === 'CONTEXT_SWITCH').length).toBe(expected);
  // Queue snapshots: replaying ENQUEUE/DISPATCH gives exactly each event's queue.
  let q: number[] = [];
  const replayed = r.events.map((e) => {
    if (e.type === 'ENQUEUE') q = [...q, e.pid!];
    if (e.type === 'DISPATCH') q = q.filter((x) => x !== e.pid);
    return q;
  });
  expect(r.events.map((e) => e.queue)).toEqual(replayed);
  expect(q).toEqual([]);
  // The running process is never in the queue during its RUN.
  expect(r.events.filter((e) => e.type === 'RUN' && e.queue.includes(e.pid!))).toEqual([]);
  // `remaining` and `duration` presence follow PLAN §3.1.
  const badFields = r.events.filter((e) => {
    const has = e.remaining !== undefined;
    const needs = e.type === 'DISPATCH' || e.type === 'RUN' || e.type === 'PREEMPT' || e.type === 'COMPLETE';
    const forbids = e.type === 'ARRIVE' || e.type === 'CONTEXT_SWITCH' || e.type === 'IDLE';
    const timed = e.type === 'RUN' || e.type === 'IDLE';
    return (needs && !has) || (forbids && has) || (timed ? !(e.duration! > 0) : e.duration !== undefined);
  });
  expect(badFields).toEqual([]);
}

/**
 * Independent tick-by-tick reference for FCFS, SJF/SRTF and Priority: at every tick pick the best arrived,
 * unfinished process (the running one keeps the CPU unless preemptive). Consecutive ticks merge into segments.
 */
function reference(ps: Process[], s: Settings): Segment[] {
  const rem = new Map(ps.map((p) => [p.pid, p.burst]));
  const preemptive = s.preemptive && (s.algorithm === 'sjf' || s.algorithm === 'priority');
  const key = (p: Process): number => {
    if (s.algorithm === 'fcfs') return p.arrival;
    if (s.algorithm === 'sjf') return preemptive ? rem.get(p.pid)! : p.burst;
    return priorityKey(p.priority, s);
  };
  const out: Segment[] = [];
  let t = Math.min(...ps.map((p) => p.arrival));
  let running: Process | null = null;
  while ([...rem.values()].some((v) => v > 0)) {
    let cur: Process | null = running && !preemptive && rem.get(running.pid)! > 0 ? running : null;
    if (!cur) {
      const ready = ps.filter((p) => p.arrival <= t && rem.get(p.pid)! > 0);
      ready.sort((a, b) => key(a) - key(b) || a.arrival - b.arrival || a.pid - b.pid);
      cur = ready[0] ?? null;
    }
    const pid = cur ? cur.pid : null;
    const last = out[out.length - 1];
    if (last && last.pid === pid && last.end === t) last.end = t + 1;
    else out.push({ pid, start: t, end: t + 1 });
    if (cur) rem.set(cur.pid, rem.get(cur.pid)! - 1);
    running = cur;
    t++;
  }
  return out;
}

// ---------- golden ----------

describe('golden: sample-result.json', () => {
  it('simulate(sample workload, sample settings) deep-equals the hand-made file', () => {
    const golden = sample as RunResult;
    const out = simulate(golden.processes, golden.settings);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result).toStrictEqual(golden);
  });

  it('the rrSample preset is the golden workload', () => {
    const golden = sample as RunResult;
    expect(presets.find((p) => p.id === 'rrSample')!.processes).toEqual(golden.processes);
  });
});

// ---------- brief §2 worked example ----------

describe('brief §2 worked example', () => {
  const ps = procs([
    [0, 6],
    [0, 2],
    [0, 4],
  ]);
  it('FCFS averages 4.67 waiting', () => {
    const r = run(ps, settings('fcfs'));
    expect(metric(r, 'waiting')).toEqual([0, 6, 8]);
    expect(r.averages.waiting.toFixed(2)).toBe('4.67');
  });
  it('SJF averages 2.67 waiting', () => {
    const r = run(ps, settings('sjf'));
    expect(metric(r, 'waiting')).toEqual([6, 0, 2]);
    expect(r.averages.waiting.toFixed(2)).toBe('2.67');
  });
});

// ---------- textbook cases ----------

describe('textbook preset, all four algorithms', () => {
  const ps = presets.find((p) => p.id === 'textbook')!.processes; // P1 6/pr2, P2 2/pr1, P3 4/pr3, all t=0

  it('FCFS', () => {
    const r = run(ps, settings('fcfs'));
    expect(segs(r)).toEqual([[1, 0, 6], [2, 6, 8], [3, 8, 12]]);
    expect(metric(r, 'completion')).toEqual([6, 8, 12]);
    expect(metric(r, 'turnaround')).toEqual([6, 8, 12]);
    expect(metric(r, 'waiting')).toEqual([0, 6, 8]);
    expect(metric(r, 'response')).toEqual([0, 6, 8]);
    expect(r.averages).toEqual({ waiting: 14 / 3, turnaround: 26 / 3, response: 14 / 3 });
    expect(r.contextSwitches).toBe(2);
    expect(r.utilisation).toBe(1);
    expect(r.throughput).toBe(3 / 12);
    expect(r.idleTime).toBe(0);
    expect(r.makespan).toBe(12);
    expect(r.events.find((e) => e.type === 'DISPATCH')!.note).toBe('earliest arrival: P1 (0)');
  });

  it('SJF', () => {
    const r = run(ps, settings('sjf'));
    expect(segs(r)).toEqual([[2, 0, 2], [3, 2, 6], [1, 6, 12]]);
    expect(metric(r, 'completion')).toEqual([12, 2, 6]);
    expect(metric(r, 'turnaround')).toEqual([12, 2, 6]);
    expect(metric(r, 'waiting')).toEqual([6, 0, 2]);
    expect(metric(r, 'response')).toEqual([6, 0, 2]);
    expect(r.averages).toEqual({ waiting: 8 / 3, turnaround: 20 / 3, response: 8 / 3 });
    expect(r.contextSwitches).toBe(2);
    expect(r.events.find((e) => e.type === 'DISPATCH')!.note).toBe('shortest burst: P2 (2)');
  });

  it('Priority (lower number = higher priority)', () => {
    const r = run(ps, settings('priority'));
    expect(segs(r)).toEqual([[2, 0, 2], [1, 2, 8], [3, 8, 12]]);
    expect(metric(r, 'completion')).toEqual([8, 2, 12]);
    expect(metric(r, 'turnaround')).toEqual([8, 2, 12]);
    expect(metric(r, 'waiting')).toEqual([2, 0, 8]);
    expect(metric(r, 'response')).toEqual([2, 0, 8]);
    expect(r.averages).toEqual({ waiting: 10 / 3, turnaround: 22 / 3, response: 10 / 3 });
    expect(r.events.find((e) => e.type === 'DISPATCH')!.note).toBe('highest priority: P2 (1)');
  });

  it('Round Robin q=2', () => {
    const r = run(ps, settings('rr', { quantum: 2 }));
    expect(segs(r)).toEqual([[1, 0, 2], [2, 2, 4], [3, 4, 6], [1, 6, 8], [3, 8, 10], [1, 10, 12]]);
    expect(metric(r, 'completion')).toEqual([12, 4, 10]);
    expect(metric(r, 'turnaround')).toEqual([12, 4, 10]);
    expect(metric(r, 'waiting')).toEqual([6, 2, 6]);
    expect(metric(r, 'response')).toEqual([0, 2, 4]);
    expect(r.averages).toEqual({ waiting: 14 / 3, turnaround: 26 / 3, response: 2 });
    expect(r.contextSwitches).toBe(5);
    expect(r.events.filter((e) => e.type === 'DISPATCH').map((e) => e.note)).toEqual([
      'front of queue: P1',
      'front of queue: P2',
      'front of queue: P3',
      'front of queue: P1',
      'front of queue: P3',
      'front of queue: P1',
    ]);
  });
});

describe('published textbook examples (Silberschatz)', () => {
  it('FCFS 24/3/3 averages 17', () => {
    const r = run(procs([[0, 24], [0, 3], [0, 3]]), settings('fcfs'));
    expect(segs(r)).toEqual([[1, 0, 24], [2, 24, 27], [3, 27, 30]]);
    expect(metric(r, 'waiting')).toEqual([0, 24, 27]);
    expect(r.averages.waiting).toBe(17);
    expect(r.averages.turnaround).toBe(27);
  });

  it('SJF 6/8/7/3 averages 7', () => {
    const r = run(procs([[0, 6], [0, 8], [0, 7], [0, 3]]), settings('sjf'));
    expect(segs(r)).toEqual([[4, 0, 3], [1, 3, 9], [3, 9, 16], [2, 16, 24]]);
    expect(metric(r, 'waiting')).toEqual([3, 16, 9, 0]);
    expect(r.averages.waiting).toBe(7);
    expect(r.averages.turnaround).toBe(13);
  });

  it('SRTF with arrivals averages 6.5', () => {
    const r = run(procs([[0, 8], [1, 4], [2, 9], [3, 5]]), settings('sjf', { preemptive: true }));
    expect(segs(r)).toEqual([[1, 0, 1], [2, 1, 5], [4, 5, 10], [1, 10, 17], [3, 17, 26]]);
    expect(metric(r, 'completion')).toEqual([17, 5, 26, 10]);
    expect(metric(r, 'turnaround')).toEqual([17, 4, 24, 7]);
    expect(metric(r, 'waiting')).toEqual([9, 0, 15, 2]);
    expect(metric(r, 'response')).toEqual([0, 0, 15, 2]);
    expect(r.averages.waiting).toBe(6.5);
    expect(r.averages.turnaround).toBe(13);
    expect(r.contextSwitches).toBe(4);
    expect(r.events.filter((e) => e.type === 'DISPATCH').map((e) => e.note)).toEqual([
      'shortest remaining: P1 (8)',
      'shortest remaining: P2 (4)',
      'shortest remaining: P4 (5)',
      'shortest remaining: P1 (7)',
      'shortest remaining: P3 (9)',
    ]);
  });

  it('Priority 10/1/2/1/5 averages 8.2', () => {
    const r = run(
      procs([[0, 10, 3], [0, 1, 1], [0, 2, 4], [0, 1, 5], [0, 5, 2]]),
      settings('priority'),
    );
    expect(segs(r)).toEqual([[2, 0, 1], [5, 1, 6], [1, 6, 16], [3, 16, 18], [4, 18, 19]]);
    expect(metric(r, 'waiting')).toEqual([6, 0, 16, 18, 1]);
    expect(r.averages.waiting).toBeCloseTo(8.2, 12);
    expect(r.averages.turnaround).toBeCloseTo(12, 12);
  });

  it('Round Robin q=4 on 24/3/3 averages 17/3', () => {
    const r = run(procs([[0, 24], [0, 3], [0, 3]]), settings('rr', { quantum: 4 }));
    expect(segs(r)).toEqual([
      [1, 0, 4], [2, 4, 7], [3, 7, 10],
      [1, 10, 14], [1, 14, 18], [1, 18, 22], [1, 22, 26], [1, 26, 30],
    ]);
    expect(metric(r, 'waiting')).toEqual([6, 4, 7]);
    expect(metric(r, 'response')).toEqual([0, 4, 7]);
    expect(r.averages.waiting).toBe(17 / 3);
    // Re-dispatching the same process alone is not a context switch.
    expect(r.contextSwitches).toBe(3);
  });
});

// ---------- idle gaps ----------

describe('idle gaps', () => {
  it('late first arrival: clock starts there, no leading idle', () => {
    for (const a of ALGORITHMS) {
      const r = run(procs([[3, 2], [4, 1]]), settings(a));
      expect(r.segments[0]).toEqual({ pid: 1, start: 3, end: 5 });
      expect(r.idleTime).toBe(0);
      expect(r.makespan).toBe(3);
      expect(r.events[0]).toEqual({ time: 3, type: 'ARRIVE', pid: 1, queue: [] });
    }
  });

  it('mid-run gap: idle segment, IDLE event and clock jump', () => {
    for (const a of ALGORITHMS) {
      const r = run(procs([[0, 2], [5, 1]]), settings(a));
      expect(segs(r)).toEqual([[1, 0, 2], [null, 2, 5], [2, 5, 6]]);
      expect(r.idleTime).toBe(3);
      expect(r.makespan).toBe(6);
      expect(r.utilisation).toBe(0.5);
      expect(r.throughput).toBe(2 / 6);
      // Idle gaps are ignored: P1 -> P2 is one switch.
      expect(r.contextSwitches).toBe(1);
      const types = r.events.map((e) => `${e.time}:${e.type}`);
      expect(types).toEqual([
        '0:ARRIVE', '0:ENQUEUE', '0:DISPATCH', '0:RUN', '2:COMPLETE', '2:IDLE',
        '5:ARRIVE', '5:ENQUEUE', '5:CONTEXT_SWITCH', '5:DISPATCH', '5:RUN', '6:COMPLETE',
      ]);
      const idle = r.events.find((e) => e.type === 'IDLE')!;
      expect(idle).toEqual({ time: 2, type: 'IDLE', pid: null, duration: 3, queue: [] });
      expect(metric(r, 'waiting')).toEqual([0, 0]);
    }
  });
});

// ---------- ties ----------

describe('ties', () => {
  it('FCFS: same arrival breaks by pid', () => {
    const r = run(procs([[1, 3], [1, 1], [0, 2]]), settings('fcfs'));
    expect(segs(r)).toEqual([[3, 0, 2], [1, 2, 5], [2, 5, 6]]);
  });

  it('SJF: same burst breaks by arrival, then pid', () => {
    const r = run(procs([[2, 2], [0, 5], [1, 2], [1, 2]]), settings('sjf'));
    // t=0 only P2; at 5 P1,P3,P4 all burst 2 -> P3 (arr 1, pid 3), P4 (arr 1, pid 4), P1 (arr 2).
    expect(segs(r)).toEqual([[2, 0, 5], [3, 5, 7], [4, 7, 9], [1, 9, 11]]);
  });

  it('Priority: same priority breaks by arrival, then pid', () => {
    const r = run(procs([[0, 1, 9], [2, 1, 1], [1, 1, 1], [1, 3, 1]]), settings('priority'));
    // t=0 P1; t=1 P3,P4 (pr 1, arr 1) -> P3; t=2 P2,P4 -> P4 (arr 1) then P2.
    expect(segs(r)).toEqual([[1, 0, 1], [3, 1, 2], [4, 2, 5], [2, 5, 6]]);
  });

  it('Priority with lowerIsHigherPriority=false prefers bigger numbers', () => {
    const ps = procs([[0, 2, 1], [0, 2, 5], [0, 2, 3]]);
    const r = run(ps, settings('priority', { lowerIsHigherPriority: false }));
    expect(segs(r)).toEqual([[2, 0, 2], [3, 2, 4], [1, 4, 6]]);
    expect(r.events.find((e) => e.type === 'DISPATCH')!.note).toBe('highest priority: P2 (5)');
  });

  it('RR: simultaneous arrivals join in pid order', () => {
    const r = run(procs([[0, 1], [0, 1], [0, 1]]), settings('rr', { quantum: 1 }));
    expect(r.events[5].queue).toEqual([1, 2, 3]);
    expect(segs(r)).toEqual([[1, 0, 1], [2, 1, 2], [3, 2, 3]]);
  });

  it('SRTF: an arrival with equal remaining does not preempt', () => {
    const r = run(procs([[0, 4], [2, 2]]), settings('sjf', { preemptive: true }));
    expect(segs(r)).toEqual([[1, 0, 4], [2, 4, 6]]);
    expect(r.events.some((e) => e.type === 'PREEMPT')).toBe(false);
  });

  it('preemptive Priority: an arrival with equal priority does not preempt', () => {
    const r = run(procs([[0, 4, 2], [1, 2, 2]]), settings('priority', { preemptive: true }));
    expect(segs(r)).toEqual([[1, 0, 4], [2, 4, 6]]);
  });
});

// ---------- single process ----------

describe('single process', () => {
  for (const a of ALGORITHMS) {
    for (const preemptive of [false, true]) {
      it(`${a}${preemptive ? ' (preemptive)' : ''}: waiting 0, response 0`, () => {
        const r = run(procs([[4, 5]]), settings(a, { preemptive, quantum: 2 }));
        expect(r.perProcess).toEqual([{ pid: 1, completion: 9, turnaround: 5, waiting: 0, response: 0 }]);
        expect(r.contextSwitches).toBe(0);
        expect(r.utilisation).toBe(1);
        expect(r.makespan).toBe(5);
      });
    }
  }
});

// ---------- Round Robin quantum ----------

describe('Round Robin quantum edge cases', () => {
  it('quantum >= every burst gives exactly the FCFS schedule (random workloads)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const ps = randomWorkload(seed, 1 + (seed % 12));
      const q = Math.max(...ps.map((p) => p.burst));
      for (const quantum of [q, q + 7]) {
        const rr = run(ps, settings('rr', { quantum }));
        const fc = run(ps, settings('fcfs', { quantum }));
        expect(rr.segments).toEqual(fc.segments);
        expect(rr.perProcess).toEqual(fc.perProcess);
        expect(rr.contextSwitches).toBe(fc.contextSwitches);
      }
    }
  });

  it('quantum 1 gives the most context switches', () => {
    const workloads = [
      presets.find((p) => p.id === 'textbook')!.processes,
      presets.find((p) => p.id === 'rrSample')!.processes,
      presets.find((p) => p.id === 'convoy')!.processes,
      procs([[0, 24], [0, 3], [0, 3]]),
    ];
    for (const ps of workloads) {
      const maxBurst = Math.max(...ps.map((p) => p.burst));
      const at = (quantum: number): number => run(ps, settings('rr', { quantum })).contextSwitches;
      const q1 = at(1);
      for (let q = 2; q <= maxBurst + 1; q++) expect(q1).toBeGreaterThanOrEqual(at(q));
      expect(q1).toBeGreaterThan(at(maxBurst));
    }
  });

  it('quantum 1 on the textbook workload alternates every tick', () => {
    const r = run(presets[0].processes, settings('rr', { quantum: 1 }));
    expect(r.segments.slice(0, 6).map((s) => s.pid)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(r.contextSwitches).toBe(10);
  });

  it('a slice ending exactly at an arrival: new arrival queues before the preempted process', () => {
    const r = run(procs([[0, 3], [2, 1]]), settings('rr', { quantum: 2 }));
    expect(segs(r)).toEqual([[1, 0, 2], [2, 2, 3], [1, 3, 4]]);
    expect(r.events.filter((e) => e.time === 2).map((e) => `${e.type}:${e.pid}:${e.queue.join('')}`)).toEqual([
      'PREEMPT:1:',
      'ARRIVE:2:',
      'ENQUEUE:2:2',
      'ENQUEUE:1:21',
      'CONTEXT_SWITCH:2:21',
      'DISPATCH:2:1',
      'RUN:2:1',
    ]);
  });
});

// ---------- preemption ----------

describe('preemption', () => {
  it('SRTF preempts exactly when a shorter job arrives', () => {
    const r = run(procs([[0, 7], [3, 2], [4, 6]]), settings('sjf', { preemptive: true }));
    // At 3 P1 has 4 left, P2 needs 2 -> preempt. At 4 P3 (6) does not beat P2 (1) or P1 (4).
    expect(segs(r)).toEqual([[1, 0, 3], [2, 3, 5], [1, 5, 9], [3, 9, 15]]);
    const preempts = r.events.filter((e) => e.type === 'PREEMPT');
    expect(preempts).toEqual([{ time: 3, type: 'PREEMPT', pid: 1, remaining: 4, queue: [] }]);
    expect(r.events.filter((e) => e.time === 3).map((e) => `${e.type}:${e.pid}`)).toEqual([
      'PREEMPT:1', 'ARRIVE:2', 'ENQUEUE:2', 'ENQUEUE:1', 'CONTEXT_SWITCH:2', 'DISPATCH:2', 'RUN:2',
    ]);
    const enq = r.events.find((e) => e.type === 'ENQUEUE' && e.pid === 1 && e.time === 3)!;
    expect(enq.remaining).toBe(4);
  });

  it('SRTF merges a slice when the running job keeps winning (no PREEMPT, one segment)', () => {
    const r = run(procs([[0, 5], [1, 10], [2, 10]]), settings('sjf', { preemptive: true }));
    expect(segs(r)).toEqual([[1, 0, 5], [2, 5, 15], [3, 15, 25]]);
    expect(r.events.filter((e) => e.type === 'DISPATCH' && e.pid === 1).length).toBe(1);
    expect(r.events.some((e) => e.type === 'PREEMPT')).toBe(false);
    expect(r.contextSwitches).toBe(2);
    // Mid-slice arrivals are still emitted at their real time.
    expect(r.events.filter((e) => e.type === 'ARRIVE').map((e) => e.time)).toEqual([0, 1, 2]);
  });

  it('preemptive Priority preempts exactly when a more important job arrives', () => {
    const r = run(procs([[0, 5, 3], [2, 2, 1], [3, 1, 4]]), settings('priority', { preemptive: true }));
    expect(segs(r)).toEqual([[1, 0, 2], [2, 2, 4], [1, 4, 7], [3, 7, 8]]);
    expect(r.events.filter((e) => e.type === 'PREEMPT').map((e) => [e.time, e.pid])).toEqual([[2, 1]]);
    expect(metric(r, 'response')).toEqual([0, 0, 4]);
  });

  it('non-preemptive SJF and Priority never preempt', () => {
    const ps = procs([[0, 7, 3], [3, 2, 1]]);
    expect(segs(run(ps, settings('sjf')))).toEqual([[1, 0, 7], [2, 7, 9]]);
    expect(segs(run(ps, settings('priority')))).toEqual([[1, 0, 7], [2, 7, 9]]);
  });

  it('preemptive flag does not affect FCFS or RR', () => {
    const ps = presets.find((p) => p.id === 'convoy')!.processes;
    for (const a of ['fcfs', 'rr'] as const) {
      const off = run(ps, settings(a));
      const on = run(ps, settings(a, { preemptive: true }));
      expect(on.segments).toEqual(off.segments);
      expect(on.events).toEqual(off.events);
    }
  });
});

// ---------- invariants on random workloads ----------

describe('invariants: 200 seeded random workloads x 4 algorithms x preemptive on/off', () => {
  for (const algorithm of ALGORITHMS) {
    for (const preemptive of [false, true]) {
      it(`${algorithm}, preemptive=${preemptive}: invariants hold${algorithm === 'rr' ? '' : ' and match the tick-level reference'}`, () => {
        let runs = 0;
        for (let seed = 1; seed <= 200; seed++) {
          const ps = randomWorkload(seed * 7919, 1 + (seed % 12));
          const quantum = 1 + (seed % 4);
          const s = settings(algorithm, { preemptive, quantum, lowerIsHigherPriority: seed % 3 !== 0 });
          const r = run(ps, s);
          checkInvariants(ps, r);
          if (algorithm !== 'rr') expect(r.segments).toEqual(reference(ps, s));
          if (algorithm === 'fcfs' || (!preemptive && algorithm !== 'rr')) {
            // Non-preemptive: one segment per process.
            expect(r.segments.filter((x) => x.pid !== null).length).toBe(ps.length);
          }
          runs++;
        }
        expect(runs).toBe(200);
      });
    }
  }

  it('is deterministic: same input gives the same output', () => {
    const ps = randomWorkload(42, 10);
    for (const a of ALGORITHMS) expect(run(ps, settings(a))).toEqual(run(ps, settings(a)));
  });

  it('does not mutate its input', () => {
    const ps = randomWorkload(7, 8);
    const copy = JSON.parse(JSON.stringify(ps)) as Process[];
    run(ps, settings('sjf', { preemptive: true }));
    expect(ps).toEqual(copy);
  });
});

// ---------- random workloads ----------

describe('randomWorkload', () => {
  it('is seeded and valid', () => {
    expect(randomWorkload(5, 6)).toEqual(randomWorkload(5, 6));
    expect(randomWorkload(5, 6)).not.toEqual(randomWorkload(6, 6));
    for (let seed = 0; seed < 50; seed++) {
      const ps = randomWorkload(seed, 12);
      expect(ps).toHaveLength(12);
      expect(validateWorkload(ps, settings('rr')).ok).toBe(true);
      ps.forEach((p, i) => {
        expect(p.pid).toBe(i + 1);
        expect(p.name).toBe(`P${i + 1}`);
        expect(p.color).toBe(colorForPid(i + 1));
      });
    }
  });

  it('clamps the size to 1..12', () => {
    expect(randomWorkload(1, 0)).toHaveLength(1);
    expect(randomWorkload(1, 40)).toHaveLength(12);
  });
});

// ---------- presets ----------

describe('presets', () => {
  it('has the required ids, textbook first, all valid', () => {
    expect(presets[0].id).toBe('textbook');
    expect(presets.map((p) => p.id)).toEqual(expect.arrayContaining(['textbook', 'convoy', 'starvation', 'rrSample']));
    for (const p of presets) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(validateWorkload(p.processes, settings('rr')).ok).toBe(true);
      p.processes.forEach((x) => expect(x.color).toBe(colorForPid(x.pid)));
    }
  });

  it('convoy: short jobs queue behind the long one under FCFS, Round Robin and SRTF avoid it', () => {
    const ps = presets.find((p) => p.id === 'convoy')!.processes;
    const fcfsWait = run(ps, settings('fcfs')).averages.waiting;
    expect(fcfsWait).toBeCloseTo(17.2, 12);
    expect(fcfsWait).toBeGreaterThan(3 * run(ps, settings('rr', { quantum: 2 })).averages.waiting);
    expect(fcfsWait).toBeGreaterThan(5 * run(ps, settings('sjf', { preemptive: true })).averages.waiting);
  });

  it('starvation: the low-priority job runs last under Priority', () => {
    const ps = presets.find((p) => p.id === 'starvation')!.processes;
    const r = run(ps, settings('priority'));
    expect(r.segments[r.segments.length - 1].pid).toBe(1);
    const p1 = r.perProcess.find((x) => x.pid === 1)!;
    expect(p1.waiting).toBe(Math.max(...r.perProcess.map((x) => x.waiting)));
  });
});

// ---------- compareAll ----------

describe('compareAll', () => {
  it('runs all four and picks the lowest average wait (textbook: SJF, then Priority)', () => {
    const out = compareAll(presets[0].processes, settings('fcfs'));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const c = out.result;
    for (const a of ALGORITHMS) {
      expect(c.runs[a].algorithm).toBe(a);
      expect(c.runs[a]).toEqual(run(presets[0].processes, settings(a)));
    }
    expect(c.winner).toBe('sjf');
    expect(c.runnerUp).toBe('priority');
    expect(c.reason).toBe('SJF wins with an average wait of 2.67, ahead of Priority (3.33), but P1 waits longest under it (6 ticks).');
  });

  it('breaks ties in the fixed order fcfs, sjf, priority, rr', () => {
    const out = compareAll(procs([[0, 3]]), settings('rr'));
    expect(out.ok && [out.result.winner, out.result.runnerUp]).toEqual(['fcfs', 'sjf']);
    if (out.ok) expect(out.result.reason).toContain('no process has to wait at all');
  });

  it('winner always has the minimum average wait (random workloads)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const out = compareAll(randomWorkload(seed, 8), settings('fcfs', { quantum: 3, preemptive: seed % 2 === 0 }));
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const waits = ALGORITHMS.map((a) => out.result.runs[a].averages.waiting);
      expect(out.result.runs[out.result.winner].averages.waiting).toBe(Math.min(...waits));
      expect(out.result.runnerUp).not.toBe(out.result.winner);
    }
  });

  it('returns errors instead of throwing on invalid input', () => {
    const out = compareAll([], settings('fcfs'));
    expect(out.ok).toBe(false);
  });
});

// ---------- validation ----------

describe('validation', () => {
  const ok = settings('rr');
  const fieldsOf = (ps: Process[], s: Settings = ok): string[] => {
    const v = validateWorkload(ps, s);
    return v.ok ? [] : v.errors.map((e) => e.field);
  };

  it('accepts a valid workload', () => {
    expect(validateWorkload(procs([[0, 1]]), ok)).toEqual({ ok: true });
  });

  it('rejects an empty workload with a clear message', () => {
    const v = validateWorkload([], ok);
    expect(v).toEqual({ ok: false, errors: [{ field: 'workload', pid: null, message: 'Add at least one process.' }] });
  });

  it('rejects more than 12 processes', () => {
    const ps = procs(Array.from({ length: 13 }, () => [0, 1] as [number, number]));
    expect(fieldsOf(ps)).toEqual(['workload']);
  });

  it('rejects burst < 1, negative arrival, non-integers and NaN, naming the process', () => {
    const bad = procs([[0, 0], [-1, 2], [0.5, 2], [0, 2.5], [0, Number.NaN]]);
    bad[1].priority = 1.5;
    const v = validateWorkload(bad, ok);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.errors.map((e) => [e.field, e.pid])).toEqual([
      ['burst', 1],
      ['arrival', 2],
      ['priority', 2],
      ['arrival', 3],
      ['burst', 4],
      ['burst', 5],
    ]);
    expect(v.errors[0].message).toBe('P1: burst must be a whole number ≥ 1.');
    expect(v.errors[1].message).toBe('P2: arrival must be a whole number ≥ 0.');
  });

  it('rejects quantum < 1 and non-integer quantum', () => {
    expect(fieldsOf(procs([[0, 1]]), settings('rr', { quantum: 0 }))).toEqual(['quantum']);
    expect(fieldsOf(procs([[0, 1]]), settings('fcfs', { quantum: 1.5 }))).toEqual(['quantum']);
  });

  it('rejects duplicate pids', () => {
    const ps = procs([[0, 1], [0, 1]]);
    ps[1] = { ...ps[1], pid: 1 };
    const v = validateWorkload(ps, ok);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toEqual([{ field: 'pid', pid: 1, message: 'P2: process id 1 is used more than once.' }]);
  });

  it('simulate returns errors instead of throwing', () => {
    expect(() => simulate(procs([[0, -3]]), ok)).not.toThrow();
    const out = simulate(procs([[0, -3]]), ok);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0].field).toBe('burst');
  });
});

// ---------- csv ----------

describe('toCsv', () => {
  it('exports per-process metrics, averages and segments', () => {
    const csv = toCsv(sample as RunResult);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('algorithm,Round Robin');
    expect(lines[1]).toBe('pid,name,arrival,burst,priority,completion,turnaround,waiting,response');
    expect(lines[2]).toBe('1,P1,0,5,1,9,9,4,0');
    expect(lines[5]).toBe('average,,,,,,6.33,3.33,1.00');
    expect(csv).toContain('segment,pid,start,end');
    expect(csv).toContain('contextSwitches,5');
  });
});
