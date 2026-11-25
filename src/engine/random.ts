// Seeded random workloads (brief §5.5). Deterministic: same seed and size give the same workload.
import { colorForPid } from '../theme/palette';
import { MAX_PROCESSES } from './validate';
import type { Process } from './types';

/** mulberry32: small, fast 32-bit seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `size` is clamped to 1..12. Arrivals fall in 0..2*size (so idle gaps can occur),
 * bursts in 1..10, priorities in 1..5.
 */
export function randomWorkload(seed: number, size: number): Process[] {
  const n = Math.min(MAX_PROCESSES, Math.max(1, Math.floor(Number.isFinite(size) ? size : 1)));
  const rand = mulberry32(Number.isFinite(seed) ? Math.floor(seed) : 0);
  const int = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
  const out: Process[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      pid: i,
      name: `P${i}`,
      arrival: int(0, 2 * n),
      burst: int(1, 10),
      priority: int(1, 5),
      color: colorForPid(i),
    });
  }
  return out;
}
