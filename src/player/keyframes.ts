// Pure replay maths for the player (no GSAP, no DOM). It only folds the engine's events and maps
// places to world geometry from layout.ts; it never decides anything about scheduling.
import type { RunResult, SimEvent } from '../engine/types';
import type { Playhead } from '../store/useApp';
import {
  CPU_CENTER,
  CPU_OUT_END,
  CPU_OUT_START,
  OUTPUT_PORT_CENTER,
  PLAYBACK,
  RAM_SLOT,
  RAM_SLOT_COUNT,
  chipCoreScale,
  ramSlotCenter,
  storageCellCenter,
  storageChipScale,
  traceSlotToCpu,
  traceStorageToSlot,
  type Point,
} from '../scene/layout';

export type Place =
  | { kind: 'storage' }
  | { kind: 'slot'; index: number }
  | { kind: 'core' }
  | { kind: 'done' };

export interface Pose {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

export type MoveKind = 'arrive' | 'slide' | 'dispatch' | 'return' | 'exit';

export interface ChipMove {
  pid: number;
  kind: MoveKind;
  /** Index into `result.events` of the event that caused the move. */
  eventIndex: number;
  from: Place;
  to: Place;
  path: Point[];
  fromPose: Pose;
  toPose: Pose;
  /** Absolute timeline position and length, in seconds. */
  start: number;
  duration: number;
}

export interface Keyframe {
  /** Simulation time of the event boundary. */
  time: number;
  place: Place;
  pose: Pose;
}

export interface Flash {
  /** Absolute timeline position, seconds. */
  at: number;
  pid: number | null;
}

export interface Plan {
  t0: number;
  /** Last simulated tick (t0 + makespan). */
  end: number;
  secondsPerTick: number;
  /** Chip moves per pid, in time order. */
  moves: Map<number, ChipMove[]>;
  /** Settled chip pose per pid after every event time, starting with the initial storage pose. */
  keyframes: Map<number, Keyframe[]>;
  /** Scheduler / core flashes positioned at the moment the dispatched chip starts moving. */
  dispatches: Flash[];
  contextSwitches: Flash[];
  /** Absolute timeline position of the first DISPATCH animation. */
  firstDispatchAt: number;
}

export interface PlanOptions {
  reducedMotion?: boolean;
}

/** Fraction of one tick that all transfers of a tick must fit into (brief §8.5). */
const TICK_BUDGET = 0.9;
const REDUCED_MOVE = 0.15;

const NOMINAL: Record<MoveKind, number> = {
  arrive: PLAYBACK.arrive,
  slide: PLAYBACK.enqueue,
  dispatch: PLAYBACK.dispatch,
  return: PLAYBACK.preempt,
  exit: PLAYBACK.complete,
};

export function timeOrigin(result: RunResult): number {
  if (result.segments.length > 0) return result.segments[0].start;
  return result.processes.reduce((m, p) => Math.min(m, p.arrival), Number.POSITIVE_INFINITY) || 0;
}

/** Simulation tick → timeline seconds. */
export function secondsAt(result: RunResult, t: number): number {
  return (t - timeOrigin(result)) * PLAYBACK.secondsPerTick;
}

/** Timeline seconds → simulation tick. */
export function tickAt(result: RunResult, seconds: number): number {
  return timeOrigin(result) + seconds / PLAYBACK.secondsPerTick;
}

// ---------------------------------------------------------------------------------------------
// Geometry for places
// ---------------------------------------------------------------------------------------------

const LAST_SLOT = RAM_SLOT_COUNT - 1;

/** Queue position → world point. Positions past the 8 RAM slots stack on the last slot, offset right. */
export function queueSlotCenter(i: number): Point {
  if (i <= LAST_SLOT) return ramSlotCenter(i);
  const c = ramSlotCenter(LAST_SLOT);
  return { x: c.x + (i - LAST_SLOT) * (RAM_SLOT.height / 2), y: c.y };
}

function sameSlotRow(i: number): number {
  return Math.min(i, LAST_SLOT);
}

export function placePose(result: RunResult, pid: number, place: Place): Pose {
  const index = result.processes.findIndex((p) => p.pid === pid);
  const burst = result.processes[index]?.burst ?? 1;
  switch (place.kind) {
    case 'storage': {
      const c = storageCellCenter(Math.max(0, index));
      return { x: c.x, y: c.y, scale: storageChipScale(burst), opacity: 1 };
    }
    case 'slot': {
      const c = queueSlotCenter(place.index);
      return { x: c.x, y: c.y, scale: 1, opacity: 1 };
    }
    case 'core':
      return { x: CPU_CENTER.x, y: CPU_CENTER.y, scale: chipCoreScale(burst), opacity: 1 };
    case 'done':
      return { x: OUTPUT_PORT_CENTER.x, y: OUTPUT_PORT_CENTER.y, scale: storageChipScale(burst), opacity: 0 };
  }
}

function pathFor(from: Point, to: Point, a: Place, b: Place): Point[] {
  if (a.kind === 'storage' && b.kind === 'slot') return [from, ...traceStorageToSlot(sameSlotRow(b.index)), to];
  if (a.kind === 'slot' && b.kind === 'core') return [from, ...traceSlotToCpu(sameSlotRow(a.index)), to];
  if (a.kind === 'core' && b.kind === 'slot') return [from, ...[...traceSlotToCpu(sameSlotRow(b.index))].reverse(), to];
  if (a.kind === 'core' && b.kind === 'done') return [from, CPU_OUT_START, CPU_OUT_END, to];
  return [from, to];
}

function kindFor(a: Place, b: Place): MoveKind {
  if (a.kind === 'storage') return 'arrive';
  if (b.kind === 'core') return 'dispatch';
  if (b.kind === 'done') return 'exit';
  if (a.kind === 'core') return 'return';
  return 'slide';
}

function samePlace(a: Place, b: Place): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'slot' || a.index === (b as { index: number }).index;
}

// ---------------------------------------------------------------------------------------------
// Event folding
// ---------------------------------------------------------------------------------------------

type Status = 'storage' | 'queued' | 'core' | 'done';

/** Place of every chip after an event, from the event's queue and the folded status. */
function placesAfter(pids: number[], status: Map<number, Status>, e: SimEvent): Map<number, Place> {
  const out = new Map<number, Place>();
  for (const pid of pids) {
    const s = status.get(pid) ?? 'storage';
    const qi = e.queue.indexOf(pid);
    if (s === 'queued' && qi >= 0) out.set(pid, { kind: 'slot', index: qi });
    else if (s === 'queued') out.set(pid, { kind: 'slot', index: 0 });
    else out.set(pid, { kind: s } as Place);
  }
  return out;
}

function applyStatus(status: Map<number, Status>, e: SimEvent): void {
  if (e.pid === null) return;
  if (e.type === 'ENQUEUE') status.set(e.pid, 'queued');
  else if (e.type === 'DISPATCH') status.set(e.pid, 'core');
  else if (e.type === 'COMPLETE') status.set(e.pid, 'done');
}

/**
 * Turn the event list into chip moves at absolute timeline positions.
 * Within one tick, each event's moves start when its subject chip is free; a chip's own moves run
 * one after another; everything in a tick is compressed to fit 90% of the tick.
 */
export function buildPlan(result: RunResult, opts: PlanOptions = {}): Plan {
  const spt = PLAYBACK.secondsPerTick;
  const t0 = timeOrigin(result);
  const pids = result.processes.map((p) => p.pid);
  const status = new Map<number, Status>(pids.map((p) => [p, 'storage']));
  let places = new Map<number, Place>(pids.map((p) => [p, { kind: 'storage' }]));

  const moves = new Map<number, ChipMove[]>(pids.map((p) => [p, []]));
  const keyframes = new Map<number, Keyframe[]>(
    pids.map((p) => [p, [{ time: Number.NEGATIVE_INFINITY, place: { kind: 'storage' }, pose: placePose(result, p, { kind: 'storage' }) }]]),
  );
  const dispatches: Flash[] = [];
  const contextSwitches: Flash[] = [];

  const events = result.events;
  let i = 0;
  while (i < events.length) {
    const time = events[i].time;
    let j = i;
    while (j < events.length && events[j].time === time) j++;

    // Offsets within this tick (seconds from the tick start), compressed afterwards.
    const tickMoves: ChipMove[] = [];
    const busyUntil = new Map<number, number>();
    const tickDispatch: { offset: number; pid: number | null }[] = [];
    const tickSwitch: { index: number; pid: number | null }[] = [];

    for (let k = i; k < j; k++) {
      const e = events[k];
      applyStatus(status, e);
      const next = placesAfter(pids, status, e);
      const subjectStart = e.pid !== null ? (busyUntil.get(e.pid) ?? 0) : 0;
      for (const pid of pids) {
        const a = places.get(pid)!;
        const b = next.get(pid)!;
        if (samePlace(a, b)) continue;
        const fromPose = placePose(result, pid, a);
        const toPose = placePose(result, pid, b);
        const kind = kindFor(a, b);
        const start = Math.max(subjectStart, busyUntil.get(pid) ?? 0);
        const duration = opts.reducedMotion ? REDUCED_MOVE : NOMINAL[kind];
        busyUntil.set(pid, start + duration);
        tickMoves.push({
          pid,
          kind,
          eventIndex: k,
          from: a,
          to: b,
          path: pathFor(fromPose, toPose, a, b),
          fromPose,
          toPose,
          start,
          duration,
        });
      }
      if (e.type === 'DISPATCH') tickDispatch.push({ offset: subjectStart, pid: e.pid });
      if (e.type === 'CONTEXT_SWITCH') tickSwitch.push({ index: tickDispatch.length, pid: e.pid });
      places = next;
    }

    const maxEnd = tickMoves.reduce((m, mv) => Math.max(m, mv.start + mv.duration), 0);
    const budget = TICK_BUDGET * spt;
    const k = maxEnd > budget ? budget / maxEnd : 1;
    const base = (time - t0) * spt;
    for (const mv of tickMoves) {
      mv.start = base + mv.start * k;
      mv.duration *= k;
      moves.get(mv.pid)!.push(mv);
    }
    for (const d of tickDispatch) dispatches.push({ at: base + d.offset * k, pid: d.pid });
    for (const s of tickSwitch) {
      // A context switch belongs to the DISPATCH that follows it in the same tick.
      const d = tickDispatch[s.index];
      contextSwitches.push({ at: base + (d ? d.offset * k : 0), pid: s.pid });
    }
    for (const pid of pids) {
      const place = places.get(pid)!;
      keyframes.get(pid)!.push({ time, place, pose: placePose(result, pid, place) });
    }
    i = j;
  }

  return {
    t0,
    end: t0 + result.makespan,
    secondsPerTick: spt,
    moves,
    keyframes,
    dispatches,
    contextSwitches,
    firstDispatchAt: dispatches[0]?.at ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Point at fraction u (0..1) of a polyline's length. */
export function pointAlong(path: Point[], u: number): Point {
  if (path.length === 1) return path[0];
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return path[path.length - 1];
  let d = clamp01(u) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 1 : Math.min(1, d / lens[i]);
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

/** Chip pose at (already eased) progress u of a move. Fading moves stay opaque for the first 60%. */
export function poseAlong(move: ChipMove, u: number): Pose {
  const p = clamp01(u);
  const at = p >= 1 ? { x: move.toPose.x, y: move.toPose.y } : p <= 0 ? { x: move.fromPose.x, y: move.fromPose.y } : pointAlong(move.path, p);
  const scale = move.fromPose.scale + (move.toPose.scale - move.fromPose.scale) * p;
  const fade = move.toPose.opacity < move.fromPose.opacity ? clamp01((p - 0.6) / 0.4) : p;
  const opacity = move.fromPose.opacity + (move.toPose.opacity - move.fromPose.opacity) * fade;
  return { x: at.x, y: at.y, scale, opacity };
}

/**
 * Where a chip rests at timeline second `sec` according to the keyframes, or null while it is
 * travelling (some move of this chip is in progress).
 */
export function settledPoseAt(plan: Plan, pid: number, sec: number): Pose | null {
  const eps = 1e-6;
  for (const mv of plan.moves.get(pid) ?? []) {
    if (sec > mv.start + eps && sec < mv.start + mv.duration - eps) return null;
  }
  const kfs = plan.keyframes.get(pid) ?? [];
  let pose = kfs[0]?.pose ?? null;
  for (const kf of kfs) {
    if (!Number.isFinite(kf.time)) continue;
    const tickStart = (kf.time - plan.t0) * plan.secondsPerTick;
    if (tickStart > sec + eps) break;
    // The keyframe only counts once all of this chip's moves of that tick have finished.
    const ownMoves = (plan.moves.get(pid) ?? []).filter((m) => Math.abs(m.start - tickStart) < plan.secondsPerTick - eps && m.start >= tickStart - eps);
    const done = ownMoves.every((m) => m.start + m.duration <= sec + eps);
    if (!done) return null;
    pose = kf.pose;
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------
// Playhead (store readouts)
// ---------------------------------------------------------------------------------------------

/** Fold all events with time <= t into the readout values shown on the hardware. */
export function playheadAt(result: RunResult, t: number): Playhead {
  let contextSwitches = 0;
  let note = '';
  let runningPid: number | null = null;
  let queue: number[] = [];
  for (const e of result.events) {
    if (e.time > t) break;
    queue = e.queue;
    switch (e.type) {
      case 'CONTEXT_SWITCH':
        contextSwitches++;
        break;
      case 'DISPATCH':
        note = e.note ?? note;
        runningPid = e.pid;
        break;
      case 'RUN':
        runningPid = e.pid;
        break;
      case 'PREEMPT':
      case 'COMPLETE':
      case 'IDLE':
        runningPid = null;
        break;
      default:
        break;
    }
  }
  return { clock: t, contextSwitches, note, runningPid, queue: [...queue] };
}

/** Distinct event times, ascending (step targets). */
export function eventTimes(result: RunResult): number[] {
  return Array.from(new Set(result.events.map((e) => e.time))).sort((a, b) => a - b);
}
