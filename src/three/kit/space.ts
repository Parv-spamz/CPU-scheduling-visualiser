// 3D extension of layout.ts. The board lies on the XZ plane: layout x -> X, layout y -> Z, Y is up.
// Layout units are millimetres; every 3D position comes from a layout value through these helpers.
import type { Point, Rect } from '../../scene/layout';
import { WORLD } from '../../scene/layout';

/** World units per millimetre (the 244 x 305 mm board becomes 12.2 x 15.25). */
export const U = 0.05;
/** Millimetres to world units, for heights and thicknesses. */
export const mm = (v: number): number => v * U;

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

/** Real part heights above the board surface (world units). */
export const H = {
  pcb: mm(1.6),
  socketBase: mm(3.2),
  ilm: mm(1.2),
  substrate: mm(1.1),
  die: mm(0.75),
  ihs: mm(2.6),
  ihsLift: mm(34),
  dimmSlot: mm(6.5),
  dimmModule: mm(40),
  pcieSlot: mm(11),
  m2: mm(2.8),
  chip: mm(1.6),
  chipHover: mm(9),
  resultsFloat: mm(70),
} as const;

/** Vertical stack of the CPU package, bottom to top. */
export const CPU_STACK = {
  substrateTop: H.socketBase + H.substrate,
  dieTop: H.socketBase + H.substrate + H.die,
  ihsTop: H.socketBase + H.substrate + H.ihs,
} as const;

/** Where a resting process packet sits, per place. */
export const PLACE_HEIGHT = {
  storage: H.m2 + mm(1.5),
  slot: H.dimmModule + mm(0.6),
  done: mm(18),
} as const;

export const FONT_SIZE = {
  panelTitle: mm(7),
  panelValue: mm(8),
  panelLabel: mm(3),
  panelSmall: mm(3.4),
} as const;
