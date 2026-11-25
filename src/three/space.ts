// 3D extension of layout.ts. The board lies on the XZ plane: layout x -> X, layout y -> Z, Y is up.
// Every 3D position is derived from a layout.ts value through these helpers; no free coordinates.
import type { Point, Rect } from '../scene/layout';
import { WORLD } from '../scene/layout';

/** World units per layout unit (the 1600 x 1000 board becomes 16 x 10). */
export const U = 0.01;

export type Vec3 = [number, number, number];

export function toX(x: number): number {
  return (x - WORLD.width / 2) * U;
}
export function toZ(y: number): number {
  return (y - WORLD.height / 2) * U;
}
export function at(p: Point, h = 0): Vec3 {
  return [toX(p.x), h, toZ(p.y)];
}
export function rectCenter(r: Rect, h = 0): Vec3 {
  return [toX(r.x + r.width / 2), h, toZ(r.y + r.height / 2)];
}
export function rectSize(r: Rect): { w: number; d: number } {
  return { w: r.width * U, d: r.height * U };
}

/** Heights (world units, board top surface = 0). */
export const H = {
  pcb: 0.12,
  socketBase: 0.1,
  socketFrame: 0.16,
  substrate: 0.04,
  die: 0.035,
  ihs: 0.09,
  ihsLift: 1.6,
  ramSlot: 0.16,
  storageFloor: 0.05,
  storageWall: 0.16,
  chip: 0.07,
  chipHover: 0.35,
  analyzer: 0.1,
  readout: 0.08,
  button: 0.07,
  resultsFloat: 1.4,
} as const;

/** Vertical stack of the CPU package, bottom to top. */
export const CPU_STACK = {
  substrateTop: H.socketBase + H.substrate,
  dieTop: H.socketBase + H.substrate + H.die,
  ihsTop: H.socketBase + H.substrate + H.ihs,
} as const;

export const FONT_SIZE = {
  silk: 0.14,
  label: 0.12,
  chip: 0.11,
  readout: 0.22,
  small: 0.085,
} as const;
