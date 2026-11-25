// LOCKED CONTRACT: DOM hooks shared by scene, camera and player (PLAN.md §3.2).

export const ATTR = {
  chip: 'data-chip',
  chipCheck: 'data-chip-check',
  chipFlash: 'data-chip-flash',
  ganttSeg: 'data-gantt-seg',
  tracePulse: 'data-trace-pulse',
  hit: 'data-hit',
  lod: 'data-lod',
} as const;

export const ID = {
  coreGlow: 'core-glow',
  coreFlash: 'core-flash',
  coreIdle: 'core-idle',
  coreProgress: 'core-progress',
  quantumRing: 'quantum-ring',
  schedulerFlash: 'scheduler-flash',
  ganttCursor: 'gantt-cursor',
} as const;

export type PulseId = 'storage-ram' | 'ram-cpu' | 'cpu-out';
export type HitId = 'cpu' | 'core' | 'board';
export type LodId = 'name' | 'detail';

export const sel = {
  chip: (pid: number) => `[${ATTR.chip}="${pid}"]`,
  chipCheck: (pid: number) => `[${ATTR.chipCheck}="${pid}"]`,
  chipFlash: (pid: number) => `[${ATTR.chipFlash}="${pid}"]`,
  ganttSeg: (index: number) => `[${ATTR.ganttSeg}="${index}"]`,
  pulse: (id: PulseId) => `[${ATTR.tracePulse}="${id}"]`,
  id: (id: string) => `#${id}`,
} as const;
