// Single source of truth for all geometry. Units are MILLIMETRES on a real ATX board (244 x 305 mm),
// lying flat: x runs from the rear I/O edge (0) to the front edge (244), y from the top edge (0) to the
// bottom edge (305). Part sizes and positions follow a typical LGA115x ATX board. Never hard-code
// coordinates anywhere else; import from here.

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const centred = (c: Point, w: number, h: number = w): Rect => ({ x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });

// ---- Board ----
export const WORLD = { width: 244, height: 305 } as const;
export const BOARD: Rect & { radius: number } = { x: 0, y: 0, width: 244, height: 305, radius: 1.5 };
/** Plated mounting holes (ATX pattern, approximate). */
export const MOUNT_HOLES: Point[] = [
  { x: 6.5, y: 8 }, { x: 160, y: 8 }, { x: 236, y: 8 },
  { x: 160, y: 168 }, { x: 236, y: 168 },
  { x: 6.5, y: 178 },
  { x: 6.5, y: 297 }, { x: 140, y: 297 }, { x: 236, y: 297 },
];

// ---- CPU (LGA115x) ----
export const CPU_CENTER: Point = { x: 104, y: 90 };
/** Socket body (black housing). */
export const SOCKET: Rect = centred(CPU_CENTER, 47.5);
export const SOCKET_SIZE = 47.5;
/** Independent loading mechanism: the steel frame and load plate around the socket. */
export const ILM: Rect = centred(CPU_CENTER, 56, 68);
/** CPU package (substrate) and heat spreader. */
export const PACKAGE_SIZE = 37.5;
export const IHS_SIZE = 32;
/** Silicon die under the heat spreader (quad-core Sandy Bridge class, 20.8 x 10.4 mm). */
export const DIE: Rect = centred(CPU_CENTER, 20.8, 10.4);
export const DIE_SIZE = 20.8;
/** The scheduled core: one tile on the die. */
export const CORE: Rect = centred({ x: CPU_CENTER.x + 1.2, y: CPU_CENTER.y }, 4.4, 6.4);
export const CORE_SIZE = 6.4;
/** System agent end of the die (flashes when the scheduler dispatches). */
export const SCHEDULER: Rect = rect(DIE.x + 0.6, DIE.y + 0.8, 3.2, DIE.height - 1.6);
export const CACHE_BLOCKS: Rect[] = [];
/** Core rings (L2 detail), radii in mm around the core. */
export const CORE_PROGRESS_RADIUS = 4.4;
export const QUANTUM_RING_RADIUS = 5.1;
export const RING_STROKE = 0.4;
/** Cooler mounting holes, 75 mm square around the socket. */
export const COOLER_HOLES: Point[] = [-37.5, 37.5].flatMap((dx) => [-37.5, 37.5].map((dy) => ({ x: CPU_CENTER.x + dx, y: CPU_CENTER.y + dy })));

// ---- Power delivery (VRM) ----
export const EPS_CONNECTOR: Rect = rect(26, 3, 18.4, 9.6);
export const VRM_HEATSINK_TOP: Rect = rect(58, 15, 56, 17);
export const VRM_HEATSINK_LEFT: Rect = rect(24, 34, 19, 86);
export const VRM_CHOKES: Point[] = [
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ x: 66 + i * 8.6, y: 40 })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 50, y: 50 + i * 8.6 })),
];
export const CHOKE_SIZE = 7.6;
/** Solid polymer capacitors: [x, y, diameter]. */
export const CAPACITORS: [number, number, number][] = [
  ...[0, 1, 2, 3, 4, 5].map((i): [number, number, number] => [66 + i * 8.6, 49.5, 6.3]),
  ...[0, 1, 2, 3, 4, 5, 6].map((i): [number, number, number] => [59.5, 54 + i * 8.6, 6.3]),
  [156, 64, 6.3], [156, 72, 6.3], [156, 106, 6.3], [156, 114, 6.3],
  [214, 28, 8], [214, 40, 8], [214, 140, 6.3],
  [158, 236, 6.3], [166, 236, 6.3], [174, 236, 6.3],
  [36, 156, 6.3], [36, 148, 6.3],
];
/** Phase LEDs along the top heat sink: light up with CPU load. */
export const PHASE_LEDS: Point[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 64 + i * 6, y: 12 }));

// ---- Memory (ready queue) ----
export const DIMM_COUNT = 4;
export const DIMM_X: readonly number[] = [172, 181.5, 194, 203.5];
export const DIMM_SLOT = { top: 11, length: 147, width: 7.2, contactTop: 18, contactLength: 133.35 } as const;
export const DIMM_SLOT_COLORS: readonly string[] = ['#141618', '#2c4a6e', '#141618', '#2c4a6e'];
/** Queue positions: three light segments per installed module, filled module by module. */
export const RAM_SLOT_COUNT = DIMM_COUNT * 3;
export const RAM_SLOT = { height: DIMM_SLOT.contactLength / 3 } as const;
export function ramSlotCenter(i: number): Point {
  const s = Math.min(DIMM_COUNT - 1, Math.floor(i / 3));
  const k = i % 3;
  return { x: DIMM_X[s]!, y: DIMM_SLOT.contactTop + RAM_SLOT.height * (k + 0.5) };
}
export const RAM_BANK: Rect = rect(DIMM_X[0]! - 6, DIMM_SLOT.top, DIMM_X[DIMM_COUNT - 1]! - DIMM_X[0]! + 12, DIMM_SLOT.length);

// ---- Expansion slots ----
export type SlotKind = 'x16' | 'x1';
export const PCIE_START_X = 46;
export const PCIE_SLOTS: { y: number; kind: SlotKind }[] = [
  { y: 166, kind: 'x1' },
  { y: 186.3, kind: 'x16' },
  { y: 226.9, kind: 'x16' },
  { y: 247.2, kind: 'x1' },
  { y: 267.5, kind: 'x16' },
  { y: 287.8, kind: 'x1' },
];
export const PCIE_LENGTH: Record<SlotKind, number> = { x16: 89, x1: 25 };

// ---- Storage (job pool): an M.2 2280 SSD between the first two x16 slots ----
export const M2: Rect = rect(48, 196.5, 82, 22);
export const STORAGE: Rect = rect(M2.x + 10, M2.y + 2.5, 64, 17);
export const STORAGE_GRID = { cols: 6, rows: 2 } as const;
export function storageCellCenter(index: number): Point {
  const col = index % STORAGE_GRID.cols;
  const row = Math.floor(index / STORAGE_GRID.cols) % STORAGE_GRID.rows;
  const cw = STORAGE.width / STORAGE_GRID.cols;
  const ch = STORAGE.height / STORAGE_GRID.rows;
  return { x: STORAGE.x + cw * (col + 0.5), y: STORAGE.y + ch * (row + 0.5) };
}

// ---- Chipset, connectors, small parts ----
export const CHIPSET: Rect = rect(150, 180, 44, 40);
export const ATX24: Rect = rect(226, 88, 10, 52);
export const USB3_HEADER: Rect = rect(227, 143, 9, 20);
export const SATA_PORTS: Rect[] = [180, 196, 212, 228].map((y) => rect(229, y, 13, 12));
export const CMOS_BATTERY: Point = { x: 92, y: 247 };
export const SUPER_IO: Rect = centred({ x: 172, y: 262 }, 14);
export const BIOS_CHIPS: Rect[] = [rect(198, 248, 5, 6), rect(198, 258, 5, 6)];
export const AUDIO_CODEC: Rect = centred({ x: 24, y: 262 }, 7);
export const LAN_CONTROLLER: Rect = centred({ x: 30, y: 132 }, 8);
export const POST_DISPLAY: Rect = rect(216, 248, 14, 9);
export const BUTTONS: Point[] = [{ x: 222, y: 266 }, { x: 222, y: 278 }];
/** 2-row pin headers along the bottom edge and elsewhere: [x, y, pins per row]. */
export const HEADERS: [number, number, number][] = [
  [200, 296, 5], [180, 296, 5], [160, 296, 5], [12, 296, 5], [146, 6, 2], [234, 64, 2], [60, 297, 2],
];

// ---- Rear I/O (along the rear edge, x < 20) ----
export type IoKind = 'ps2' | 'usb2' | 'usb3' | 'lan' | 'audio';
export const REAR_IO: { kind: IoKind; rect: Rect; height: number }[] = [
  { kind: 'ps2', rect: rect(-2.5, 16, 18, 14), height: 13 },
  { kind: 'usb2', rect: rect(-2.5, 34, 17, 15), height: 16 },
  { kind: 'usb2', rect: rect(-2.5, 53, 17, 15), height: 16 },
  { kind: 'usb3', rect: rect(-2.5, 72, 17, 15), height: 16 },
  { kind: 'lan', rect: rect(-2.5, 91, 21, 17), height: 31 },
  { kind: 'audio', rect: rect(-2.5, 126, 20, 40), height: 32 },
];

// ---- Output port (finished processes leave through the network port) ----
export const OUTPUT_PORT: Rect = REAR_IO.find((p) => p.kind === 'lan')!.rect;
export const OUTPUT_PORT_CENTER: Point = { x: OUTPUT_PORT.x + 6, y: OUTPUT_PORT.y + OUTPUT_PORT.height / 2 };

// ---- Data paths (orthogonal, along board copper) ----
/** Vertical bus corridor between the cooler zone and the memory slots. */
export const BUS_X = 147;
export const STORAGE_EXIT: Point = { x: M2.x + M2.width, y: M2.y + M2.height / 2 };
export const SOCKET_ENTRY: Point = { x: ILM.x + ILM.width, y: CPU_CENTER.y };
export const CPU_OUT_START: Point = { x: CPU_CENTER.x, y: 132 };
export const CPU_OUT_END: Point = { x: 22, y: 132 };

export function traceStorageToSlot(i: number): Point[] {
  const c = ramSlotCenter(i);
  return [STORAGE_EXIT, { x: BUS_X, y: STORAGE_EXIT.y }, { x: BUS_X, y: c.y }, { x: c.x - 3, y: c.y }];
}
export function traceSlotToCpu(i: number): Point[] {
  const c = ramSlotCenter(i);
  return [{ x: c.x - 3, y: c.y }, { x: BUS_X, y: c.y }, { x: BUS_X, y: CPU_CENTER.y }, SOCKET_ENTRY];
}
export const TRACE_CPU_OUT: Point[] = [CPU_OUT_START, CPU_OUT_END];

// ---- Process packets (the moving "data") ----
export const CHIP_HEIGHT = 3;
export function chipWidth(burst: number): number {
  return Math.min(18, Math.max(6, 4.5 + 1.2 * burst));
}
/** Scale that makes a packet fit the core tile. */
export function chipCoreScale(burst: number): number {
  return Math.min((CORE.height * 0.8) / chipWidth(burst), 1);
}
/** Scale that makes a packet fit its storage cell. */
export function storageChipScale(burst: number): number {
  const cell = STORAGE.width / STORAGE_GRID.cols;
  return Math.min(1, (cell * 0.85) / chipWidth(burst));
}

// ---- Results layer (L3): four panels floating over the board ----
export const RESULT_PANEL_SIZE = { width: 112, height: 128 } as const;
export const RESULT_PANELS: Point[] = [
  { x: 6, y: 16 },
  { x: 126, y: 16 },
  { x: 6, y: 160 },
  { x: 126, y: 160 },
];

// ---- Camera ----
export type Level = 'L0' | 'L1' | 'L2' | 'L3';
export const LEVELS: readonly Level[] = ['L0', 'L1', 'L2', 'L3'];
export const LEVEL_RECTS: Record<Level, Rect> = {
  L0: rect(-4, 0, 250, 305),
  L1: rect(60, 40, 156, 120),
  L2: centred(CPU_CENTER, 30, 22),
  L3: rect(0, 0, 244, 305),
};
export const LEVEL_LABEL: Record<Level, string> = { L0: 'Board', L1: 'CPU', L2: 'Core', L3: 'Results' };

export const CAMERA = {
  duration: 1.2,
  reducedMotionDuration: 0.35,
} as const;

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
