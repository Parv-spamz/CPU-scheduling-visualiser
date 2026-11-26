// PCB maps (colour, roughness, bump) for a black ATX board, plus the SMD placements shared with Pcb.tsx.
// Everything is in layout millimetres. No text is drawn: silkscreen is outlines only.
import * as THREE from 'three';
import { cache, canvas, finish, rng } from '../kit/canvasTexture';
import {
  ATX24,
  AUDIO_CODEC,
  BIOS_CHIPS,
  BOARD,
  BUS_X,
  BUTTONS,
  CAPACITORS,
  CHIPSET,
  CHOKE_SIZE,
  CMOS_BATTERY,
  COOLER_HOLES,
  CPU_CENTER,
  CPU_OUT_END,
  CPU_OUT_START,
  DIMM_SLOT,
  DIMM_X,
  EPS_CONNECTOR,
  HEADERS,
  ILM,
  LAN_CONTROLLER,
  M2,
  MOUNT_HOLES,
  OUTPUT_PORT_CENTER,
  PCIE_LENGTH,
  PCIE_SLOTS,
  PCIE_START_X,
  PHASE_LEDS,
  POST_DISPLAY,
  REAR_IO,
  SATA_PORTS,
  SOCKET_ENTRY,
  STORAGE_EXIT,
  SUPER_IO,
  USB3_HEADER,
  VRM_CHOKES,
  VRM_HEATSINK_LEFT,
  VRM_HEATSINK_TOP,
  WORLD,
  type Point,
  type Rect,
} from '../../scene/layout';

type Mode = 'color' | 'rough' | 'bump' | 'emit';

const grow = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m });
const inside = (p: Point, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const around = (p: Point, s: number): Rect => ({ x: p.x - s / 2, y: p.y - s / 2, width: s, height: s });

/** Footprints of every placed part: routing and SMD parts stay clear of these. */
export const KEEP_OUT: Rect[] = [
  grow(ILM, 3),
  VRM_HEATSINK_TOP,
  VRM_HEATSINK_LEFT,
  EPS_CONNECTOR,
  grow({ x: DIMM_X[0]! - 4, y: DIMM_SLOT.top, width: DIMM_X[3]! - DIMM_X[0]! + 8, height: DIMM_SLOT.length }, 1),
  ...PCIE_SLOTS.map((s) => ({ x: PCIE_START_X - 1, y: s.y - 4.5, width: PCIE_LENGTH[s.kind] + (s.kind === 'x16' ? 8 : 2), height: 9 })),
  grow(M2, 1),
  grow(CHIPSET, 2),
  grow(ATX24, 1),
  grow(USB3_HEADER, 1),
  ...SATA_PORTS.map((r) => grow(r, 1)),
  around(CMOS_BATTERY, 24),
  grow(SUPER_IO, 3),
  grow(AUDIO_CODEC, 3),
  grow(LAN_CONTROLLER, 3),
  grow(POST_DISPLAY, 1),
  ...BIOS_CHIPS.map((r) => grow(r, 2)),
  ...BUTTONS.map((b) => around(b, 10)),
  ...REAR_IO.map((p) => grow(p.rect, 1)),
  ...VRM_CHOKES.map((c) => around(c, CHOKE_SIZE + 1)),
  ...CAPACITORS.map(([x, y, d]) => around({ x, y }, d + 1)),
  ...MOUNT_HOLES.map((h) => around(h, 9)),
  ...COOLER_HOLES.map((h) => around(h, 7)),
  ...HEADERS.map(([x, y, n]) => ({ x: x - 1.5, y: y - 2.5, width: n * 2.54 + 2, height: 6 })),
];

interface Trace { pts: Point[]; w: number; bright: number }
interface Via { p: Point; r: number }
export interface Smd { p: Point; w: number; h: number; rot: number; kind: 'res' | 'cap' | 'ic' }
interface Routing { traces: Trace[]; vias: Via[]; smd: Smd[]; outlines: Rect[]; circles: { p: Point; r: number }[] }

let routingCache: Routing | null = null;

function clearPath(pts: Point[], margin = 2): boolean {
  const board = grow(BOARD, -4);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      if (!inside(p, board)) return false;
      if (KEEP_OUT.some((r) => inside(p, grow(r, margin - 2)))) return false;
    }
  }
  return true;
}

/** A serpentine (length-matching meander) between a and b along x. */
function serpentine(a: Point, b: Point, amp: number, pitch: number): Point[] {
  const out: Point[] = [a];
  const n = Math.max(2, Math.floor(Math.abs(b.x - a.x) / pitch));
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const y = a.y + ((b.y - a.y) * i) / n + (i % 2 ? amp : -amp);
    out.push({ x, y: out[out.length - 1]!.y }, { x, y });
  }
  out.push({ x: b.x, y: out[out.length - 1]!.y }, b);
  return out;
}

export function routing(): Routing {
  if (routingCache) return routingCache;
  const g = rng(1155);
  const traces: Trace[] = [];
  const vias: Via[] = [];
  const smd: Smd[] = [];

  // Memory bus: dense parallel traces from the socket's right edge to the DIMM slots, with meanders.
  for (let i = 0; i < 46; i++) {
    const y = ILM.y + 4 + i * 1.3;
    const xEnd = DIMM_X[i % 4]! - 4;
    const a = { x: ILM.x + ILM.width + 1, y };
    const mid = { x: 150, y };
    const pts = i % 3 === 0 ? [a, ...serpentine({ x: a.x + 4, y }, mid, 0.5, 1.6), { x: xEnd, y }] : [a, { x: xEnd, y }];
    traces.push({ pts, w: 0.16, bright: 0.9 });
  }
  // PCIe lanes: differential pairs from the socket bottom to the first x16 slot.
  for (let i = 0; i < 16; i++) {
    const x0 = ILM.x + 8 + i * 2.4;
    for (const d of [0, 0.45]) {
      traces.push({ pts: [{ x: x0 + d, y: ILM.y + ILM.height + 1 }, { x: x0 + d, y: 170 }, { x: x0 + d - 4, y: 176 }, { x: x0 + d - 4, y: 181 }], w: 0.14, bright: 0.85 });
    }
  }
  // DMI / chipset link and SATA lanes.
  for (let i = 0; i < 8; i++) {
    const y = 176 + i * 0.8;
    traces.push({ pts: [{ x: 138, y: 128 + i * 0.8 }, { x: 142 + i * 0.6, y: 132 + i * 0.6 }, { x: 142 + i * 0.6, y }, { x: 149, y }], w: 0.14, bright: 0.8 });
    traces.push({ pts: [{ x: 196, y: 186 + i * 3.5 }, { x: 214, y: 186 + i * 3.5 }, { x: 228, y: 182 + i * 6 }], w: 0.16, bright: 0.8 });
  }
  // Power pours (wide planes) feeding the VRM and socket.
  traces.push({ pts: [{ x: 35, y: 13 }, { x: 35, y: 30 }, { x: 60, y: 34 }], w: 3.2, bright: 0.6 });
  traces.push({ pts: [{ x: 58, y: 36 }, { x: 70, y: 52 }], w: 4, bright: 0.55 });
  traces.push({ pts: [{ x: 231, y: 141 }, { x: 214, y: 150 }, { x: 196, y: 175 }], w: 2.2, bright: 0.55 });

  // The data paths used by process packets: slightly brighter so the light trails sit on real copper.
  const data = [
    [STORAGE_EXIT, { x: BUS_X, y: STORAGE_EXIT.y }, { x: BUS_X, y: 20 }],
    [{ x: BUS_X, y: CPU_CENTER.y }, SOCKET_ENTRY],
    [{ x: CPU_CENTER.x, y: ILM.y + ILM.height }, CPU_OUT_START, CPU_OUT_END, OUTPUT_PORT_CENTER],
  ];
  for (const pts of data) traces.push({ pts, w: 0.5, bright: 1.15 });
  for (let i = 0; i < 12; i++) {
    const y = DIMM_SLOT.contactTop + (DIMM_SLOT.contactLength / 3) * ((i % 3) + 0.5);
    traces.push({ pts: [{ x: BUS_X, y }, { x: DIMM_X[Math.floor(i / 3)]! - 4, y }], w: 0.3, bright: 1 });
  }

  // Random 45-degree signal routing in the free areas, with vias at the ends.
  let placed = 0;
  for (let attempt = 0; attempt < 9000 && placed < 520; attempt++) {
    const a = { x: 6 + g() * (WORLD.width - 12), y: 6 + g() * (WORLD.height - 12) };
    const len1 = 6 + g() * 30;
    const len2 = 4 + g() * 24;
    const dir = g() < 0.5 ? 1 : -1;
    const horizontal = g() < 0.55;
    const b = horizontal ? { x: a.x + len1 * dir, y: a.y } : { x: a.x, y: a.y + len1 * dir };
    const diag = g() < 0.5 ? 1 : -1;
    const c = horizontal ? { x: b.x + len2 * 0.4 * dir, y: b.y + len2 * 0.4 * diag } : { x: b.x + len2 * 0.4 * diag, y: b.y + len2 * 0.4 * dir };
    const d = horizontal ? { x: c.x + len2 * dir, y: c.y } : { x: c.x, y: c.y + len2 * dir };
    const pts = [a, b, c, d];
    if (!clearPath(pts)) continue;
    const bundle = g() < 0.35 ? 3 + Math.floor(g() * 4) : 1;
    for (let k = 0; k < bundle; k++) {
      const off = k * 0.55;
      traces.push({ pts: pts.map((p) => (horizontal ? { x: p.x, y: p.y + off } : { x: p.x + off, y: p.y })), w: 0.13 + g() * 0.06, bright: 0.7 + g() * 0.25 });
    }
    vias.push({ p: a, r: 0.32 }, { p: d, r: 0.32 });
    placed++;
  }
  for (let i = 0; i < 900; i++) {
    const p = { x: 4 + g() * (WORLD.width - 8), y: 4 + g() * (WORLD.height - 8) };
    if (!KEEP_OUT.some((r) => inside(p, grow(r, 0.5)))) vias.push({ p, r: 0.25 + g() * 0.12 });
  }

  // SMD passives: tidy rows around the socket, memory and VRM, and scattered clusters elsewhere.
  const row = (x0: number, y0: number, n: number, dx: number, dy: number, kind: Smd['kind'], rot = 0) => {
    for (let i = 0; i < n; i++) {
      const p = { x: x0 + dx * i, y: y0 + dy * i };
      if (KEEP_OUT.some((r) => inside(p, grow(r, 0.4)))) continue;
      smd.push(kind === 'res' ? { p, w: 1.6, h: 0.8, rot, kind } : { p, w: 2, h: 1.25, rot, kind });
    }
  };
  row(ILM.x + 2, ILM.y - 4, 26, 2.1, 0, 'cap');
  row(ILM.x + 2, ILM.y + ILM.height + 4, 26, 2.1, 0, 'res');
  row(ILM.x - 4, ILM.y + 4, 28, 0, 2.2, 'cap', Math.PI / 2);
  row(ILM.x + ILM.width + 4, ILM.y + 2, 30, 0, 2.2, 'res', Math.PI / 2);
  row(DIMM_X[0]! - 7.5, 22, 56, 0, 2.3, 'cap', Math.PI / 2);
  row(DIMM_X[3]! + 6.5, 22, 56, 0, 2.3, 'res', Math.PI / 2);
  for (let k = 0; k < 70; k++) {
    const c = { x: 8 + g() * (WORLD.width - 16), y: 8 + g() * (WORLD.height - 16) };
    if (KEEP_OUT.some((r) => inside(c, grow(r, 2)))) continue;
    const n = 3 + Math.floor(g() * 6);
    const vertical = g() < 0.5;
    row(c.x, c.y, n, vertical ? 0 : 2.2, vertical ? 2.2 : 0, g() < 0.5 ? 'res' : 'cap', vertical ? Math.PI / 2 : 0);
  }
  // Small ICs (regulators, level shifters, clock buffers) in free spots.
  for (let k = 0; k < 160 && smd.filter((s) => s.kind === 'ic').length < 14; k++) {
    const p = { x: 10 + g() * (WORLD.width - 20), y: 10 + g() * (WORLD.height - 20) };
    const w = 3 + g() * 4;
    const h = 3 + g() * 3;
    if (KEEP_OUT.some((r) => inside(p, grow(r, w))) || smd.some((s) => Math.hypot(s.p.x - p.x, s.p.y - p.y) < w + 2)) continue;
    smd.push({ p, w, h, rot: 0, kind: 'ic' });
  }

  const outlines: Rect[] = [
    grow(EPS_CONNECTOR, 0.8), grow(ATX24, 0.8), grow(USB3_HEADER, 0.8), grow(M2, 0.6), grow(CHIPSET, 1.2),
    grow(SUPER_IO, 1.5), grow(AUDIO_CODEC, 1.5), grow(LAN_CONTROLLER, 1.5), grow(POST_DISPLAY, 0.8),
    ...SATA_PORTS.map((r) => grow(r, 0.6)), ...BIOS_CHIPS.map((r) => grow(r, 0.8)),
    ...VRM_CHOKES.map((c) => around(c, CHOKE_SIZE + 0.8)),
    ...HEADERS.map(([x, y, n]) => ({ x: x - 1.4, y: y - 2.6, width: n * 2.54 + 0.3, height: 5.2 })),
  ];
  const circles = [
    ...CAPACITORS.map(([x, y, d]) => ({ p: { x, y }, r: d / 2 + 0.5 })),
    { p: CMOS_BATTERY, r: 11.2 },
    ...PHASE_LEDS.map((p) => ({ p, r: 0.9 })),
  ];

  routingCache = { traces, vias, smd, outlines, circles };
  return routingCache;
}

function stroke(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function drawPcb(ctx: CanvasRenderingContext2D, mode: Mode, k: number) {
  const R = routing();
  const g = rng(7);
  ctx.save();
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Solder mask base: near-black with a faint blue cast, fine mottling.
  ctx.fillStyle = mode === 'color' ? '#0b0d0f' : mode === 'rough' ? '#7a7a7a' : mode === 'emit' ? '#000000' : '#303030';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  if (mode === 'color') {
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(${g() < 0.5 ? '255,255,255' : '0,0,0'},${0.012 + g() * 0.012})`;
      ctx.fillRect(g() * WORLD.width, g() * WORLD.height, 1 + g() * 5, 1 + g() * 5);
    }
  }

  // Copper under the mask: barely visible, slightly glossier and raised.
  for (const t of R.traces) {
    ctx.lineWidth = t.w;
    if (mode === 'emit') {
      // Only the brighter routes glow faintly, so the circuit reads at a distance.
      if (t.bright < 0.8) continue;
      ctx.lineWidth = t.w * 1.15;
      ctx.strokeStyle = `rgba(70,200,215,${Math.min(1, 0.5 * t.bright)})`;
      stroke(ctx, t.pts);
      continue;
    }
    ctx.strokeStyle =
      mode === 'color' ? `rgba(84,104,116,${Math.min(1, 0.95 * t.bright)})` : mode === 'rough' ? '#4a4a4a' : `rgba(190,190,190,${Math.min(1, t.bright)})`;
    stroke(ctx, t.pts);
  }
  if (mode === 'emit') {
    ctx.restore();
    return;
  }
  for (const v of R.vias) {
    ctx.fillStyle = mode === 'color' ? '#3a4248' : mode === 'rough' ? '#555' : '#a0a0a0';
    ctx.beginPath();
    ctx.arc(v.p.x, v.p.y, v.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mode === 'color' ? '#050607' : mode === 'rough' ? '#888' : '#202020';
    ctx.beginPath();
    ctx.arc(v.p.x, v.p.y, v.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exposed pads under SMD parts and around big parts (tinned copper).
  const pad = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = mode === 'color' ? '#8d8f8c' : mode === 'rough' ? '#3a3a3a' : '#b0b0b0';
    ctx.fillRect(x, y, w, h);
  };
  for (const s of R.smd) {
    if (s.kind === 'ic') continue;
    ctx.save();
    ctx.translate(s.p.x, s.p.y);
    ctx.rotate(s.rot);
    pad(-s.w / 2 - 0.25, -s.h / 2, 0.55, s.h);
    pad(s.w / 2 - 0.3, -s.h / 2, 0.55, s.h);
    ctx.restore();
  }

  // Silkscreen: thin white outlines only, no text.
  if (mode !== 'rough') {
    ctx.strokeStyle = mode === 'color' ? 'rgba(214,218,222,0.78)' : 'rgba(170,170,170,1)';
    ctx.lineWidth = 0.16;
    for (const r of R.outlines) ctx.strokeRect(r.x, r.y, r.width, r.height);
    for (const c of R.circles) {
      ctx.beginPath();
      ctx.arc(c.p.x, c.p.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Polarity marks on capacitors (a filled half-moon).
    ctx.fillStyle = mode === 'color' ? 'rgba(214,218,222,0.5)' : 'rgba(150,150,150,1)';
    for (const [x, y, d] of CAPACITORS) {
      ctx.beginPath();
      ctx.arc(x, y, d / 2 + 0.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x, y, d / 2 + 0.15, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.fill();
    }
    // Corner ticks around the socket and the CPU keep-out square.
    ctx.lineWidth = 0.2;
    const sq = { x: CPU_CENTER.x - 42, y: CPU_CENTER.y - 42, s: 84 };
    for (const [cx, cy, dx, dy] of [
      [sq.x, sq.y, 1, 1], [sq.x + sq.s, sq.y, -1, 1], [sq.x, sq.y + sq.s, 1, -1], [sq.x + sq.s, sq.y + sq.s, -1, -1],
    ] as const) {
      stroke(ctx, [{ x: cx + dx * 6, y: cy }, { x: cx, y: cy }, { x: cx, y: cy + dy * 6 }]);
    }
    // Pin-1 dots next to ICs.
    for (const r of [SUPER_IO, AUDIO_CODEC, LAN_CONTROLLER, ...BIOS_CHIPS]) {
      ctx.beginPath();
      ctx.arc(r.x - 1.2, r.y - 1.2, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Plated holes: tinned rings with a dark bore.
  for (const h of [...MOUNT_HOLES.map((p) => ({ p, r: 4 })), ...COOLER_HOLES.map((p) => ({ p, r: 3 }))]) {
    ctx.fillStyle = mode === 'color' ? '#a9aba7' : mode === 'rough' ? '#3a3a3a' : '#c0c0c0';
    ctx.beginPath();
    ctx.arc(h.p.x, h.p.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mode === 'color' ? '#050505' : mode === 'rough' ? '#ffffff' : '#000000';
    ctx.beginPath();
    ctx.arc(h.p.x, h.p.y, h.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function pcbTexture(mode: Mode): THREE.Texture {
  const key = `pcb-${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const k = mode === 'color' ? 12 : mode === 'emit' ? 8 : 7;
  const [c, ctx] = canvas(Math.round(WORLD.width * k), Math.round(WORLD.height * k));
  drawPcb(ctx, mode, k);
  const tex = finish(new THREE.CanvasTexture(c), mode === 'color' || mode === 'emit');
  cache.set(key, tex);
  return tex;
}
