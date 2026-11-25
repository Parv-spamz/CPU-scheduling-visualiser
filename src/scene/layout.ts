// LOCKED CONTRACT: single source of truth for all geometry (brief §7.5).
// Never hard-code coordinates anywhere else; import from here.

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export const WORLD = { width: 1600, height: 1000 } as const;

export const BOARD: Rect & { radius: number } = { x: 40, y: 40, width: 1520, height: 920, radius: 24 };

export const POWER_BLOCK: Rect = { x: 80, y: 80, width: 200, height: 120 };

export const CPU_CENTER: Point = { x: 700, y: 400 };
export const SOCKET_SIZE = 300;
export const DIE_SIZE = 220;
export const CORE_SIZE = 90;

const centred = (c: Point, w: number, h: number = w): Rect => ({ x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });

export const SOCKET: Rect = centred(CPU_CENTER, SOCKET_SIZE);
export const DIE: Rect = centred(CPU_CENTER, DIE_SIZE);
export const CORE: Rect = centred(CPU_CENTER, CORE_SIZE);

export const SCHEDULER_CENTER: Point = { x: 700, y: 322 };
export const SCHEDULER: Rect = centred(SCHEDULER_CENTER, 180, 36);

export const CACHE_SIZE = 36;
export const CACHE_INSET = 8;
/** Four decorative cache blocks in the die corners. */
export const CACHE_BLOCKS: Rect[] = [
  { x: DIE.x + CACHE_INSET, y: DIE.y + CACHE_INSET, width: CACHE_SIZE, height: CACHE_SIZE },
  { x: DIE.x + DIE.width - CACHE_INSET - CACHE_SIZE, y: DIE.y + CACHE_INSET, width: CACHE_SIZE, height: CACHE_SIZE },
  { x: DIE.x + CACHE_INSET, y: DIE.y + DIE.height - CACHE_INSET - CACHE_SIZE, width: CACHE_SIZE, height: CACHE_SIZE },
  {
    x: DIE.x + DIE.width - CACHE_INSET - CACHE_SIZE,
    y: DIE.y + DIE.height - CACHE_INSET - CACHE_SIZE,
    width: CACHE_SIZE,
    height: CACHE_SIZE,
  },
];

/** Core rings (L2 detail). Radii in world units, centred on CPU_CENTER. */
export const CORE_PROGRESS_RADIUS = 38;
export const QUANTUM_RING_RADIUS = 43;
export const RING_STROKE = 3;

// ---- Ready queue (RAM) ----
export const RAM_SLOT_COUNT = 8;
export const RAM_SLOT = { x: 1100, firstY: 220, pitch: 44, width: 240, height: 36 } as const;
export function ramSlotRect(i: number): Rect {
  return { x: RAM_SLOT.x, y: RAM_SLOT.firstY + RAM_SLOT.pitch * i, width: RAM_SLOT.width, height: RAM_SLOT.height };
}
export function ramSlotCenter(i: number): Point {
  const r = ramSlotRect(i);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
/** Bounding box around all 8 slots (for decoration / hit area). */
export const RAM_BANK: Rect = {
  x: RAM_SLOT.x - 12,
  y: RAM_SLOT.firstY - 12,
  width: RAM_SLOT.width + 24,
  height: RAM_SLOT.pitch * (RAM_SLOT_COUNT - 1) + RAM_SLOT.height + 24,
};

// ---- Storage connector (job pool) ----
export const STORAGE: Rect = { x: 60, y: 520, width: 320, height: 240 };
export const STORAGE_GRID = { cols: 4, rows: 3 } as const;
export const STORAGE_CHIP_SCALE = 0.6;
export function storageCellCenter(index: number): Point {
  const col = index % STORAGE_GRID.cols;
  const row = Math.floor(index / STORAGE_GRID.cols);
  const cw = STORAGE.width / STORAGE_GRID.cols;
  const ch = STORAGE.height / STORAGE_GRID.rows;
  return { x: STORAGE.x + cw * (col + 0.5), y: STORAGE.y + ch * (row + 0.5) };
}

// ---- Output port ----
export const OUTPUT_PORT_CENTER: Point = { x: 700, y: 90 };
export const OUTPUT_PORT: Rect = centred(OUTPUT_PORT_CENTER, 120, 40);

// ---- Gantt strip ----
export const GANTT: Rect = { x: 420, y: 640, width: 1060, height: 100 };
export const GANTT_LANE = { top: 20, height: 44 } as const; // offsets inside GANTT
export function ganttX(t: number, t0: number, makespan: number): number {
  return GANTT.x + (makespan > 0 ? ((t - t0) / makespan) * GANTT.width : 0);
}

// ---- Clock / counter readout near the CPU ----
export const CLOCK_READOUT: Rect = { x: 870, y: 560, width: 160, height: 56 };

// ---- Results layer (L3) ----
export const RESULT_PANEL_SIZE = { width: 700, height: 400 } as const;
export const RESULT_PANELS: Point[] = [
  { x: 80, y: 100 },
  { x: 820, y: 100 },
  { x: 80, y: 540 },
  { x: 820, y: 540 },
];

// ---- Algorithm ring around the socket (L1) ----
export const ALGO_BUTTON = { width: 72, height: 26 } as const;
/** Centres of the four selector buttons on the socket edges (fcfs, sjf, priority, rr). */
export const ALGO_RING: Point[] = [
  { x: SOCKET.x + SOCKET.width / 2 - 100, y: SOCKET.y - 22 },
  { x: SOCKET.x + SOCKET.width / 2, y: SOCKET.y - 22 },
  { x: SOCKET.x + SOCKET.width / 2 + 100, y: SOCKET.y - 22 },
  { x: SOCKET.x + SOCKET.width / 2, y: SOCKET.y + SOCKET.height + 22 },
];

// ---- Traces (orthogonal polylines) ----
export const BUS_X = 1060;
export const STORAGE_EXIT: Point = { x: 380, y: 580 };
export const SOCKET_ENTRY: Point = { x: SOCKET.x + SOCKET.width, y: CPU_CENTER.y }; // (850, 400)
export const CPU_OUT_START: Point = { x: 700, y: 250 };
export const CPU_OUT_END: Point = { x: 700, y: 110 };

export function traceStorageToSlot(i: number): Point[] {
  const y = ramSlotCenter(i).y;
  return [STORAGE_EXIT, { x: BUS_X, y: STORAGE_EXIT.y }, { x: BUS_X, y }, { x: RAM_SLOT.x, y }];
}
export function traceSlotToCpu(i: number): Point[] {
  const y = ramSlotCenter(i).y;
  return [{ x: RAM_SLOT.x, y }, { x: BUS_X, y }, { x: BUS_X, y: CPU_CENTER.y }, SOCKET_ENTRY];
}
export const TRACE_CPU_OUT: Point[] = [CPU_OUT_START, CPU_OUT_END];

export function polylinePoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

// ---- Chips ----
export const CHIP_HEIGHT = 28;
export const CHIP_RADIUS = 6;
export function chipWidth(burst: number): number {
  return Math.min(180, Math.max(56, 40 + 12 * burst));
}
/** Scale that makes a chip fit inside the core with a margin. */
export function chipCoreScale(burst: number): number {
  return Math.min((CORE_SIZE - 16) / chipWidth(burst), 1.6);
}

// ---- Camera ----
export type Level = 'L0' | 'L1' | 'L2' | 'L3';
export const LEVELS: readonly Level[] = ['L0', 'L1', 'L2', 'L3'];
export const LEVEL_RECTS: Record<Level, Rect> = {
  L0: { x: 0, y: 0, width: 1600, height: 1000 },
  L1: { x: 400, y: 180, width: 1100, height: 600 },
  L2: { x: 560, y: 260, width: 280, height: 280 },
  L3: { x: 0, y: 0, width: 1600, height: 1000 },
};
export const LEVEL_LABEL: Record<Level, string> = { L0: 'Board', L1: 'CPU', L2: 'Core', L3: 'Results' };

export const CAMERA = {
  duration: 1.2,
  ease: 'power3.inOut',
  reducedMotionDuration: 0.35,
  wheelDebounceMs: 400,
} as const;

export const LOD = { names: 1.3, detail: 3 } as const;
export function zoomFor(viewBoxWidth: number): number {
  return WORLD.width / viewBoxWidth;
}

// ---- Playback ----
export const PLAYBACK = {
  secondsPerTick: 1.0,
  transferMax: 0.6,
  arrive: 0.6,
  enqueue: 0.3,
  dispatch: 0.5,
  schedulerFade: 0.2,
  preempt: 0.4,
  contextSwitch: 0.2,
  complete: 0.5,
  holdBeforeResults: 1.5,
  speeds: [0.5, 1, 2, 4] as readonly number[],
} as const;

export const NARROW_BREAKPOINT_PX = 720;
