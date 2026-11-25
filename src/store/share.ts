// Shareable links: the workload and settings encoded in the URL hash, e.g.
//   #w=0.5.2,1.3.1,2.8.4&a=rr&q=2&p=0&h=1
// w = arrival.burst.priority per process (pid = position), a = algorithm, q = quantum,
// p = preemptive (0/1), h = lowerIsHigherPriority (0/1). Pure functions; the engine still validates.
import { ALGORITHMS, type AlgorithmId, type Process, type Settings } from '../engine/types';

export interface Shared {
  processes: Process[];
  settings: Settings;
}

/** Hard cap on what we try to parse; the engine reports anything beyond its own limit of 12. */
const MAX_PROCESSES = 64;
const INT = /^-?\d{1,6}$/;

export function encodeShare({ processes, settings }: Shared): string {
  const w = processes.map((p) => `${p.arrival}.${p.burst}.${p.priority}`).join(',');
  const params = new URLSearchParams({
    w,
    a: settings.algorithm,
    q: String(settings.quantum),
    p: settings.preemptive ? '1' : '0',
    h: settings.lowerIsHigherPriority ? '1' : '0',
  });
  // Commas and dots are safe in a fragment; keep the link readable.
  return params.toString().replace(/%2C/g, ',');
}

/**
 * Parse a hash (with or without the leading `#`). Returns null when it is not a well-formed share,
 * so a stray or hand-edited hash falls back to the default workload instead of an error state.
 * Missing settings fall back to `defaults`.
 */
export function decodeShare(hash: string, defaults: Settings): Shared | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const w = params.get('w');
  if (!w) return null;
  const parts = w.split(',');
  if (parts.length === 0 || parts.length > MAX_PROCESSES) return null;

  const processes: Process[] = [];
  for (const [i, part] of parts.entries()) {
    const nums = part.split('.');
    if (nums.length !== 3 || !nums.every((n) => INT.test(n))) return null;
    const [arrival, burst, priority] = nums.map(Number) as [number, number, number];
    processes.push({ pid: i + 1, name: `P${i + 1}`, arrival, burst, priority, color: '' });
  }

  const a = params.get('a');
  const algorithm: AlgorithmId = a && (ALGORITHMS as readonly string[]).includes(a) ? (a as AlgorithmId) : defaults.algorithm;
  const q = params.get('q');
  const quantum = q !== null && INT.test(q) ? Number(q) : defaults.quantum;
  const flag = (key: string, fallback: boolean): boolean => {
    const v = params.get(key);
    return v === '1' ? true : v === '0' ? false : fallback;
  };
  return {
    processes,
    settings: {
      algorithm,
      quantum,
      preemptive: flag('p', defaults.preemptive),
      lowerIsHigherPriority: flag('h', defaults.lowerIsHigherPriority),
    },
  };
}
