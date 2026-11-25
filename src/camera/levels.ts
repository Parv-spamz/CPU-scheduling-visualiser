// The level state machine (brief §8.2) and gesture gate. Pure: no DOM, no three.js.
import type { Level } from '../scene/layout';
export type HitId = 'cpu' | 'core' | 'board';

// ---- Level state machine (§8.2) ----

/** Wheel / pinch / Escape order: Board → CPU → Core. Results is reached by breadcrumb or auto-follow. */
export function deeper(level: Level): Level {
  switch (level) {
    case 'L0': return 'L1';
    case 'L1': return 'L2';
    case 'L2': return 'L2';
    case 'L3': return 'L1';
  }
}

export function shallower(level: Level): Level {
  switch (level) {
    case 'L0': return 'L0';
    case 'L1': return 'L0';
    case 'L2': return 'L1';
    case 'L3': return 'L0';
  }
}

export type Trigger =
  | 'clickCpu'
  | 'firstDispatch'
  | 'clickCore'
  | 'stepIntoSlice'
  | 'back'
  | 'sliceEnds'
  | 'runFinishes'
  | 'compare'
  | 'clickMiniCpu';

export interface Transition { from: Level; trigger: Trigger; to: Level }

/** Brief §8.2 transition table (breadcrumb / wheel moves are handled by deeper/shallower/setLevel). */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'L0', trigger: 'clickCpu', to: 'L1' },
  { from: 'L0', trigger: 'firstDispatch', to: 'L1' },
  { from: 'L1', trigger: 'clickCore', to: 'L2' },
  { from: 'L1', trigger: 'stepIntoSlice', to: 'L2' },
  { from: 'L2', trigger: 'back', to: 'L1' },
  { from: 'L2', trigger: 'sliceEnds', to: 'L1' },
  { from: 'L1', trigger: 'runFinishes', to: 'L3' },
  { from: 'L1', trigger: 'compare', to: 'L3' },
  { from: 'L3', trigger: 'clickMiniCpu', to: 'L1' },
];

/** Next level for a trigger, or the current level when the table has no matching row. */
export function transition(from: Level, trigger: Trigger): Level {
  return TRANSITIONS.find((t) => t.from === from && t.trigger === trigger)?.to ?? from;
}

/**
 * Target level for a click on a scene part. The core sits inside the CPU, so from the
 * board a click on it first enters the CPU (one level per click). `board` never moves the camera.
 */
export function levelForHit(hit: string, current: Level): Level | null {
  const id = hit as HitId;
  if (id === 'cpu') return 'L1';
  if (id === 'core') return current === 'L1' || current === 'L2' ? 'L2' : 'L1';
  return null;
}

// ---- Gesture gate (wheel / pinch debounce) ----

/**
 * One level per gesture: the first event of a gesture passes, every event that follows within
 * `debounceMs` of the previous one is swallowed (and extends the gesture).
 */
export function createGestureGate(debounceMs: number): (now: number) => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return (now) => {
    const pass = now - last >= debounceMs;
    last = now;
    return pass;
  };
}
