// Pure camera maths and the level state machine (brief §7.5, §8.2). No DOM, no GSAP.
import { LEVEL_RECTS, LOD, WORLD, zoomFor } from '../scene/layout';
import type { Level, Rect } from '../scene/layout';
export type HitId = 'cpu' | 'core' | 'board';

/** A camera view in world units, written verbatim into the svg `viewBox`. */
export type ViewBox = Rect;

/**
 * Smallest viewBox that contains `rect`, is centred on it and has the window's aspect ratio
 * (`aspect` = window width / height). Invalid aspects fall back to the rect's own aspect.
 */
export function fitRect(rect: Rect, aspect: number): ViewBox {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : rect.width / rect.height;
  let width = rect.width;
  let height = rect.height;
  if (a > rect.width / rect.height) width = height * a;
  else height = width / a;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/** The fitted viewBox for a level at the given window aspect. */
export function levelViewBox(level: Level, aspect: number): ViewBox {
  return fitRect(LEVEL_RECTS[level], aspect);
}

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/**
 * Camera interpolation at progress `p` (0..1): centre linear, width in log space so the zoom speed
 * feels constant; height follows the (linearly blended) aspect ratio.
 */
export function interpolateViewBox(a: ViewBox, b: ViewBox, p: number): ViewBox {
  const cx = lerp(a.x + a.width / 2, b.x + b.width / 2, p);
  const cy = lerp(a.y + a.height / 2, b.y + b.height / 2, p);
  const width = Math.exp(lerp(Math.log(a.width), Math.log(b.width), p));
  const aspect = lerp(a.width / a.height, b.width / b.height, p);
  const height = width / aspect;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

export function viewBoxString(v: ViewBox): string {
  const r = (n: number): number => Math.round(n * 100) / 100;
  return `${r(v.x)} ${r(v.y)} ${r(v.width)} ${r(v.height)}`;
}

// ---- Level of detail ----

export interface LodState { name: 0 | 1; detail: 0 | 1 }

/** Which label groups are visible at a given viewBox width (`zoom = 1600 / width`). */
export function lodFor(viewBoxWidth: number): LodState {
  const zoom = zoomFor(viewBoxWidth);
  return { name: zoom >= LOD.names ? 1 : 0, detail: zoom >= LOD.detail ? 1 : 0 };
}

// ---- Pan within a level ----

/**
 * Move `base` by (dx, dy) world units, clamped so the view never leaves the world. On an axis where
 * the view is already larger than the world, the base position is kept (no pan).
 */
export function panViewBox(base: ViewBox, dx: number, dy: number): ViewBox {
  // The allowed range always includes the fitted position, so a level rect that pokes past the
  // world edge stays reachable.
  const clampAxis = (start: number, delta: number, size: number, worldSize: number): number => {
    if (size >= worldSize) return start;
    const min = Math.min(0, start);
    const max = Math.max(worldSize - size, start);
    return Math.min(max, Math.max(min, start + delta));
  };
  const x = clampAxis(base.x, dx, base.width, WORLD.width);
  const y = clampAxis(base.y, dy, base.height, WORLD.height);
  return { x, y, width: base.width, height: base.height };
}

// ---- Level state machine (§8.2) ----

/** Wheel / pinch / Escape order: Board â†’ CPU â†’ Core. Results is reached by breadcrumb or auto-follow. */
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
 * Target level for a click on a `[data-hit]` element. The core sits inside the CPU, so from the
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
