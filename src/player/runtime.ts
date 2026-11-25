// Per-frame shared state for the 3D scene. Written by PlayerDriver / Socket inside the render
// loop and read by other components in useFrame. Never put this in React state.
import type { RunResult } from '../engine/types';
import type { Plan } from './keyframes';

export interface Runtime {
  run: RunResult | null;
  plan: Plan | null;
  /** Timeline seconds since the run origin. */
  sec: number;
  /** Simulation tick at `sec`. */
  t: number;
  /** 0 = heat spreader seated, 1 = fully lifted off the die. */
  ihsLift: number;
  /** Smoothed CPU pressure 0..1 (drives the overload glow). */
  load: number;
  /** Seconds of wall time since start (for idle animations). */
  clock: number;
  /** 0..1 rise of the results deck (L3). */
  results: number;
}

export const rt: Runtime = { run: null, plan: null, sec: 0, t: 0, ihsLift: 0, load: 0, clock: 0, results: 0 };
