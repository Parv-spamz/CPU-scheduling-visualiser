// Pick rules (brief §5.2a). Every rule except Round Robin is a total order: key, then arrival, then pid.
import type { AlgorithmId, Settings } from './types';

export interface ReadyItem {
  pid: number;
  name: string;
  arrival: number;
  burst: number;
  remaining: number;
  priority: number;
  enqueuedAt: number;
}

export interface Pick {
  item: ReadyItem;
  note: string;
}

export type PickRule = (ready: ReadyItem[], settings: Settings, now: number) => Pick;

function minBy(ready: ReadyItem[], key: (r: ReadyItem) => number): ReadyItem {
  let best = ready[0];
  for (let i = 1; i < ready.length; i++) {
    const r = ready[i];
    const kr = key(r);
    const kb = key(best);
    if (kr < kb || (kr === kb && (r.arrival < best.arrival || (r.arrival === best.arrival && r.pid < best.pid)))) {
      best = r;
    }
  }
  return best;
}

/** Priority sort key: smaller is more important. */
export function priorityKey(priority: number, settings: Settings): number {
  return settings.lowerIsHigherPriority ? priority : -priority;
}

/** Whether this algorithm + settings re-evaluates the pick at every arrival (SRTF, preemptive Priority). */
export function isPreemptive(settings: Settings): boolean {
  return settings.preemptive && (settings.algorithm === 'sjf' || settings.algorithm === 'priority');
}

export const fcfs: PickRule = (ready) => {
  const item = minBy(ready, (r) => r.arrival);
  return { item, note: `earliest arrival: ${item.name} (${item.arrival})` };
};

export const sjf: PickRule = (ready, settings) => {
  if (settings.preemptive) {
    const item = minBy(ready, (r) => r.remaining);
    return { item, note: `shortest remaining: ${item.name} (${item.remaining})` };
  }
  const item = minBy(ready, (r) => r.burst);
  return { item, note: `shortest burst: ${item.name} (${item.burst})` };
};

export const priority: PickRule = (ready, settings) => {
  const item = minBy(ready, (r) => priorityKey(r.priority, settings));
  return { item, note: `highest priority: ${item.name} (${item.priority})` };
};

export const rr: PickRule = (ready) => {
  const item = ready[0];
  return { item, note: `front of queue: ${item.name}` };
};

export const PICK_RULES: Record<AlgorithmId, PickRule> = { fcfs, sjf, priority, rr };
