// Pure "scene as a function of time" helpers. They only read the engine's RunResult and the
// replay plan from keyframes.ts; they never make a scheduling decision.
import type { RunResult, Segment } from '../engine/types';
import type { ChipMove, Flash, Plan, Pose } from './keyframes';
import { poseAlong } from './keyframes';

export function easeInOut(u: number): number {
  const p = u < 0 ? 0 : u > 1 ? 1 : u;
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export interface ChipFrame {
  pose: Pose;
  /** The move in progress, if the chip is travelling. */
  move: ChipMove | null;
  /** 0..1 progress of the move in progress. */
  u: number;
}

/** Pose of a chip at timeline second `sec`. Scrub-safe: depends on nothing but its inputs. */
export function chipFrameAt(plan: Plan, pid: number, sec: number): ChipFrame {
  const moves = plan.moves.get(pid) ?? [];
  let pose: Pose = plan.keyframes.get(pid)?.[0]?.pose ?? { x: 0, y: 0, scale: 1, opacity: 0 };
  for (const mv of moves) {
    if (sec < mv.start) break;
    const end = mv.start + mv.duration;
    if (sec < end && mv.duration > 0) {
      const u = (sec - mv.start) / mv.duration;
      return { pose: poseAlong(mv, easeInOut(u)), move: mv, u };
    }
    pose = mv.toPose;
  }
  return { pose, move: null, u: 0 };
}

/** Seconds since the latest flash at or before `sec` (Infinity if none). */
export function sinceLast(flashes: readonly Flash[], sec: number): { dt: number; pid: number | null } {
  let best: Flash | null = null;
  for (const f of flashes) {
    if (f.at > sec) break;
    best = f;
  }
  return best ? { dt: sec - best.at, pid: best.pid } : { dt: Number.POSITIVE_INFINITY, pid: null };
}

export interface CoreFrame {
  /** Segment covering tick t (pid null = idle), or null before start / after end. */
  segment: Segment | null;
  /** Remaining burst fraction of the running process, 1 = untouched, 0 = done. */
  remainingFrac: number;
  /** Fraction of the Round Robin quantum used in the current slice (0..1). */
  quantumFrac: number;
}

export function coreFrameAt(run: RunResult, t: number, quantum: number): CoreFrame {
  const seg = run.segments.find((s) => t >= s.start && t < s.end) ?? null;
  if (!seg || seg.pid === null) return { segment: seg, remainingFrac: 0, quantumFrac: 0 };
  const proc = run.processes.find((p) => p.pid === seg.pid);
  const burst = proc?.burst ?? 1;
  let ran = 0;
  for (const s of run.segments) {
    if (s.pid !== seg.pid || s.start >= t) continue;
    ran += Math.min(t, s.end) - s.start;
  }
  const q = Math.max(1, quantum);
  return {
    segment: seg,
    remainingFrac: Math.max(0, 1 - ran / burst),
    quantumFrac: Math.min(1, (t - seg.start) / q),
  };
}

/** Ready-queue length after the last event at or before tick t. */
export function queueLengthAt(run: RunResult, t: number): number {
  let n = 0;
  for (const e of run.events) {
    if (e.time > t) break;
    n = e.queue.length;
  }
  return n;
}

/** CPU pressure 0..1 from the waiting queue: 0 with nobody waiting, 1 with four or more waiting. */
export function loadFromQueue(queueLength: number): number {
  return Math.min(1, queueLength / 4);
}

/** Burst left for a process at tick t, folded from the engine's segments. */
export function remainingAt(run: RunResult, pid: number, t: number): number {
  const burst = run.processes.find((p) => p.pid === pid)?.burst ?? 0;
  let ran = 0;
  for (const s of run.segments) {
    if (s.pid !== pid || s.start >= t) continue;
    ran += Math.min(t, s.end) - s.start;
  }
  return Math.max(0, burst - ran);
}

/** Where a chip rests (or is heading from) at timeline second `sec`. */
export function restingPlaceAt(plan: Plan, pid: number, sec: number): ChipMove['to'] {
  let place: ChipMove['to'] = { kind: 'storage' };
  for (const mv of plan.moves.get(pid) ?? []) {
    if (mv.start + mv.duration > sec) break;
    place = mv.to;
  }
  return place;
}
