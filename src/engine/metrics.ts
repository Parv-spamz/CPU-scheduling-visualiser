// Per-process and overall metrics (brief §2, §5.4; PLAN §3.1). Averages are raw floats.
import type { Process, ProcessResult, RunResult, Segment, Settings, SimEvent } from './types';

export function computeMetrics(
  processes: Process[],
  settings: Settings,
  segments: Segment[],
  events: SimEvent[],
  firstStart: ReadonlyMap<number, number>,
): RunResult {
  const completion = new Map<number, number>();
  let busy = 0;
  let idleTime = 0;
  for (const s of segments) {
    if (s.pid === null) {
      idleTime += s.end - s.start;
    } else {
      busy += s.end - s.start;
      completion.set(s.pid, Math.max(completion.get(s.pid) ?? 0, s.end));
    }
  }

  const perProcess: ProcessResult[] = [...processes]
    .sort((a, b) => a.pid - b.pid)
    .map((p) => {
      const ct = completion.get(p.pid) ?? 0;
      const turnaround = ct - p.arrival;
      return {
        pid: p.pid,
        completion: ct,
        turnaround,
        waiting: turnaround - p.burst,
        response: (firstStart.get(p.pid) ?? p.arrival) - p.arrival,
      };
    });

  const n = perProcess.length;
  const sum = (f: (r: ProcessResult) => number): number => perProcess.reduce((a, r) => a + f(r), 0);
  const earliest = Math.min(...processes.map((p) => p.arrival));
  const lastCompletion = Math.max(...perProcess.map((r) => r.completion));
  const makespan = lastCompletion - earliest;

  return {
    algorithm: settings.algorithm,
    settings: { ...settings },
    processes: processes.map((p) => ({ ...p })),
    segments,
    events,
    perProcess,
    averages: {
      waiting: sum((r) => r.waiting) / n,
      turnaround: sum((r) => r.turnaround) / n,
      response: sum((r) => r.response) / n,
    },
    utilisation: busy / makespan,
    throughput: n / makespan,
    contextSwitches: events.filter((e) => e.type === 'CONTEXT_SWITCH').length,
    idleTime,
    makespan,
  };
}
