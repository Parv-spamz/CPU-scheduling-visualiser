// The one simulator loop for every algorithm (brief §5.2, §5.2a; PLAN §3.1).
//
// Events are emitted in chronological order, so the stream is already sorted by (time, EVENT_RANK, seq)
// and every `queue` snapshot is the true ready queue after that event:
//   slice start:  [CONTEXT_SWITCH] DISPATCH RUN
//   mid-slice:    ARRIVE ENQUEUE for each process arriving strictly inside the slice
//   slice end:    COMPLETE | PREEMPT, then ARRIVE ENQUEUE for arrivals at the slice end,
//                 then ENQUEUE of the preempted process (back of the queue).
// Preemptive slices (SRTF, preemptive Priority) are computed ahead to the next arrival that actually
// wins the pick, so a re-pick of the same pid is merged into one segment with no PREEMPT/CONTEXT_SWITCH.
import { isPreemptive, PICK_RULES, type ReadyItem } from './algorithms';
import { computeMetrics } from './metrics';
import { validateWorkload } from './validate';
import type { Process, RunResult, Segment, Settings, SimEvent, SimulateOutcome } from './types';

function toReady(p: Process): ReadyItem {
  return {
    pid: p.pid,
    name: p.name,
    arrival: p.arrival,
    burst: p.burst,
    remaining: p.burst,
    priority: p.priority,
    enqueuedAt: p.arrival,
  };
}

/** Runs the simulation on an already validated workload. */
export function runSimulation(processes: Process[], settings: Settings): RunResult {
  const pick = PICK_RULES[settings.algorithm];
  const preemptive = isPreemptive(settings);
  const pending = processes
    .map(toReady)
    .sort((a, b) => a.arrival - b.arrival || a.pid - b.pid);

  const events: SimEvent[] = [];
  const segments: Segment[] = [];
  const queue: ReadyItem[] = [];
  const firstStart = new Map<number, number>();
  let next = 0; // index into pending of the next process to arrive
  let lastRan: number | null = null;
  let done = 0;
  let t = pending[0].arrival;

  const pids = (): number[] => queue.map((r) => r.pid);
  const emit = (e: Omit<SimEvent, 'queue'>): void => {
    events.push({ ...e, queue: pids() });
  };

  /**
   * Admit every not-yet-arrived process with arrival <= limit (or < limit when strict).
   * Simultaneous arrivals emit all their ARRIVEs before their ENQUEUEs, in (arrival, pid) order.
   */
  const admit = (limit: number, strict: boolean): void => {
    const due = (k: number): boolean =>
      k < pending.length && (strict ? pending[k].arrival < limit : pending[k].arrival <= limit);
    while (due(next)) {
      const at = pending[next].arrival;
      const group: ReadyItem[] = [];
      while (due(next) && pending[next].arrival === at) group.push(pending[next++]);
      for (const item of group) emit({ time: at, type: 'ARRIVE', pid: item.pid });
      for (const item of group) {
        queue.push(item);
        emit({ time: at, type: 'ENQUEUE', pid: item.pid });
      }
    }
  };

  /** Slice end for a preemptive algorithm: finish, or the first arrival at which someone else wins. */
  const preemptiveEnd = (running: ReadyItem, start: number): number => {
    const finish = start + running.remaining;
    let k = next;
    while (k < pending.length && pending[k].arrival < finish) {
      const at = pending[k].arrival;
      while (k < pending.length && pending[k].arrival === at) k++;
      const candidate: ReadyItem = { ...running, remaining: running.remaining - (at - start) };
      const pool = [...queue, ...pending.slice(next, k), candidate];
      if (pick(pool, settings, at).item.pid !== running.pid) return at;
    }
    return finish;
  };

  while (done < pending.length) {
    admit(t, false);

    if (queue.length === 0) {
      const until = pending[next].arrival;
      emit({ time: t, type: 'IDLE', pid: null, duration: until - t });
      segments.push({ pid: null, start: t, end: until });
      t = until;
      continue;
    }

    const { item, note } = pick(queue, settings, t);
    if (lastRan !== null && lastRan !== item.pid) {
      emit({ time: t, type: 'CONTEXT_SWITCH', pid: item.pid });
    }
    queue.splice(queue.indexOf(item), 1);
    emit({ time: t, type: 'DISPATCH', pid: item.pid, remaining: item.remaining, note });
    if (!firstStart.has(item.pid)) firstStart.set(item.pid, t);

    let end: number;
    if (settings.algorithm === 'rr') end = t + Math.min(settings.quantum, item.remaining);
    else if (preemptive) end = preemptiveEnd(item, t);
    else end = t + item.remaining;

    const duration = end - t;
    item.remaining -= duration;
    emit({ time: t, type: 'RUN', pid: item.pid, duration, remaining: item.remaining });
    segments.push({ pid: item.pid, start: t, end });
    lastRan = item.pid;

    admit(end, true);
    if (item.remaining === 0) {
      emit({ time: end, type: 'COMPLETE', pid: item.pid, remaining: 0 });
      done++;
      admit(end, false);
    } else {
      emit({ time: end, type: 'PREEMPT', pid: item.pid, remaining: item.remaining });
      admit(end, false);
      item.enqueuedAt = end;
      queue.push(item);
      emit({ time: end, type: 'ENQUEUE', pid: item.pid, remaining: item.remaining });
    }
    t = end;
  }

  return computeMetrics(processes, settings, segments, events, firstStart);
}

/** Public entry point: validates first and never throws. */
export function simulate(processes: Process[], settings: Settings): SimulateOutcome {
  const v = validateWorkload(processes, settings);
  if (!v.ok) return v;
  return { ok: true, result: runSimulation(processes, settings) };
}
