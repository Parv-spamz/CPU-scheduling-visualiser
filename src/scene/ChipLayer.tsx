import type { Process, RunResult } from '../engine/types';
import Chip from './Chip';

/** Event types whose `remaining` describes the chip between slices (PLAN §3.1). */
const REMAINING_TYPES = new Set(['DISPATCH', 'PREEMPT', 'ENQUEUE', 'COMPLETE']);

/** Replays the engine's events up to `clock` to read each pid's remaining burst (no scheduling maths). */
function remainingAt(run: RunResult | null, processes: Process[], clock: number): Map<number, number> {
  const rem = new Map(processes.map((p) => [p.pid, p.burst]));
  for (const e of run?.events ?? []) {
    if (e.time > clock) break;
    if (e.pid !== null && e.remaining !== undefined && REMAINING_TYPES.has(e.type)) rem.set(e.pid, e.remaining);
  }
  return rem;
}

interface Props {
  processes: Process[];
  run: RunResult | null;
  runningPid: number | null;
  clock: number;
  lowerIsHigherPriority: boolean;
}

/** All process chips, on top of the board. */
export default function ChipLayer({ processes, run, runningPid, clock, lowerIsHigherPriority }: Props) {
  const rem = remainingAt(run, processes, clock);
  const prios = processes.map((p) => p.priority);
  const bestPriority = prios.length === 0 ? null : lowerIsHigherPriority ? Math.min(...prios) : Math.max(...prios);
  return (
    <g>
      {processes.map((p, i) => (
        <Chip
          key={p.pid}
          process={p}
          index={i}
          active={p.pid === runningPid}
          best={p.priority === bestPriority}
          remaining={rem.get(p.pid) ?? p.burst}
        />
      ))}
    </g>
  );
}
