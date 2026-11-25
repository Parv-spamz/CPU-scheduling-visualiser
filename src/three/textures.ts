// Procedural textures drawn on canvases at runtime (no image assets, no network).
// All placement derives from layout.ts rects and trace helpers.
import * as THREE from 'three';
import {
  BOARD,
  BUS_X,
  CLOCK_READOUT,
  CPU_CENTER,
  GANTT,
  OUTPUT_PORT,
  POWER_BLOCK,
  RAM_BANK,
  RAM_SLOT_COUNT,
  SOCKET,
  STORAGE,
  STORAGE_EXIT,
  TRACE_CPU_OUT,
  WORLD,
  ALGO_RING,
  ALGO_BUTTON,
  ramSlotCenter,
  traceSlotToCpu,
  traceStorageToSlot,
  type Point,
  type Rect,
} from '../scene/layout';

type Mode = 'color' | 'rough' | 'bump';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grow(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}
function inside(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

const ALGO_ROW: Rect = {
  x: ALGO_RING[0].x - ALGO_BUTTON.width / 2,
  y: ALGO_RING[0].y - ALGO_BUTTON.height / 2,
  width: ALGO_RING[3].x - ALGO_RING[0].x + ALGO_BUTTON.width,
  height: ALGO_BUTTON.height,
};

/** Areas covered by 3D parts; decorative routing stays out of them. */
export const KEEP_OUT: Rect[] = [
  grow(SOCKET, 26),
  grow(RAM_BANK, 14),
  grow(STORAGE, 16),
  grow(POWER_BLOCK, 14),
  grow(OUTPUT_PORT, 14),
  grow(GANTT, 16),
  grow(CLOCK_READOUT, 12),
  grow(ALGO_ROW, 14),
];

// ------------------------------------------------------------------------------------------
// Board routing model (computed once, drawn into several maps)
// ------------------------------------------------------------------------------------------

interface Trace { pts: Point[]; w: number; kind: 'signal' | 'bus' | 'power' }
interface Via { p: Point; r: number }
interface Smd { p: Point; w: number; h: number; rot: number }

interface Routing { traces: Trace[]; vias: Via[]; pads: Smd[]; labels: { p: Point; text: string; size: number; rot?: number }[] }

let routingCache: Routing | null = null;

function freePath(pts: Point[]): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      if (!inside(p, grow(BOARD, -18))) return false;
      if (KEEP_OUT.some((r) => inside(p, r))) return false;
    }
  }
  return true;
}

export function routing(): Routing {
  if (routingCache) return routingCache;
  const r = rng(1977);
  const traces: Trace[] = [];
  const vias: Via[] = [];
  const pads: Smd[] = [];
  const labels: Routing['labels'] = [];

  // Main data paths from layout (drawn bold; the 3D flow ribbons sit on top of these).
  for (let i = 0; i < RAM_SLOT_COUNT; i++) {
    traces.push({ pts: traceStorageToSlot(i), w: 5, kind: 'bus' });
    traces.push({ pts: traceSlotToCpu(i), w: 5, kind: 'bus' });
  }
  traces.push({ pts: TRACE_CPU_OUT, w: 6, kind: 'bus' });

  // Memory fan-out: parallel lines from the socket's right edge into the RAM bank with 45° jogs.
  const sx = SOCKET.x + SOCKET.width + 26;
  for (let i = 0; i < 22; i++) {
    const y0 = CPU_CENTER.y - 110 + i * 10;
    const slot = Math.floor((i / 22) * RAM_SLOT_COUNT);
    const y1 = ramSlotCenter(slot).y - 14 + (i % 3) * 9;
    const xj = sx + 40 + i * 3;
    const dy = y1 - y0;
    const pts: Point[] = [
      { x: sx, y: y0 },
      { x: xj, y: y0 },
      { x: xj + Math.abs(dy), y: y1 },
      { x: RAM_BANK.x - 4, y: y1 },
    ];
    if (pts[2].x < RAM_BANK.x - 30) traces.push({ pts, w: 1.6, kind: 'signal' });
  }

  // Power pour from the VRM block toward the socket.
  traces.push({
    pts: [
      { x: POWER_BLOCK.x + POWER_BLOCK.width + 14, y: POWER_BLOCK.y + 60 },
      { x: SOCKET.x - 60, y: POWER_BLOCK.y + 60 },
      { x: SOCKET.x - 26, y: SOCKET.y + 30 },
    ],
    w: 26,
    kind: 'power',
  });
  traces.push({
    pts: [
      { x: POWER_BLOCK.x + 40, y: POWER_BLOCK.y + POWER_BLOCK.height + 14 },
      { x: POWER_BLOCK.x + 40, y: SOCKET.y + SOCKET.height - 40 },
      { x: SOCKET.x - 26, y: SOCKET.y + SOCKET.height - 40 },
    ],
    w: 18,
    kind: 'power',
  });

  // Random signal routing in free areas: orthogonal + 45° segments, vias at both ends.
  let tries = 0;
  while (traces.length < 260 && tries < 6000) {
    tries++;
    const a = { x: BOARD.x + 30 + r() * (BOARD.width - 60), y: BOARD.y + 30 + r() * (BOARD.height - 60) };
    const horiz = r() < 0.6;
    const l1 = 20 + r() * 120;
    const l2 = 10 + r() * 50;
    const l3 = 20 + r() * 120;
    const sgn = r() < 0.5 ? -1 : 1;
    const sgn2 = r() < 0.5 ? -1 : 1;
    const pts: Point[] = horiz
      ? [a, { x: a.x + sgn * l1, y: a.y }, { x: a.x + sgn * (l1 + l2), y: a.y + sgn2 * l2 }, { x: a.x + sgn * (l1 + l2 + l3), y: a.y + sgn2 * l2 }]
      : [a, { x: a.x, y: a.y + sgn * l1 }, { x: a.x + sgn2 * l2, y: a.y + sgn * (l1 + l2) }, { x: a.x + sgn2 * l2, y: a.y + sgn * (l1 + l2 + l3) }];
    if (!freePath(pts)) continue;
    // Small bundle of 1-3 parallel lines.
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const off = k * 5;
      const shifted = pts.map((p) => (horiz ? { x: p.x, y: p.y + off } : { x: p.x + off, y: p.y }));
      if (!freePath(shifted)) break;
      traces.push({ pts: shifted, w: 1.4 + r() * 0.8, kind: 'signal' });
      vias.push({ p: shifted[0], r: 3.2 });
      vias.push({ p: shifted[shifted.length - 1], r: 3.2 });
    }
  }

  // Scattered via field and SMD pads.
  for (let i = 0; i < 900 && vias.length < 900; i++) {
    const p = { x: BOARD.x + 20 + r() * (BOARD.width - 40), y: BOARD.y + 20 + r() * (BOARD.height - 40) };
    if (KEEP_OUT.some((k) => inside(p, k))) continue;
    if (r() < 0.12) vias.push({ p, r: 2.6 });
  }
  // Organised SMD placement: decoupling rows around the socket, resistor arrays by the RAM bank,
  // and small clusters in free board areas (real boards place passives in neat rows).
  const row = (x0: number, y0: number, dx: number, dy: number, n: number, w: number, h: number, rot: number) => {
    for (let i = 0; i < n; i++) {
      const p = { x: x0 + dx * i, y: y0 + dy * i };
      if (KEEP_OUT.some((k) => inside(p, grow(k, 2)))) continue;
      if (!inside(p, grow(BOARD, -20))) continue;
      pads.push({ p, w, h, rot });
    }
  };
  const so = grow(SOCKET, 38);
  row(so.x + 20, so.y, 18, 0, Math.floor((so.width - 40) / 18), 10, 5, 0);
  row(so.x + 20, so.y + so.height, 18, 0, Math.floor((so.width - 40) / 18), 10, 5, 0);
  row(so.x, so.y + 24, 0, 18, Math.floor((so.height - 48) / 18), 10, 5, Math.PI / 2);
  row(so.x + so.width, so.y + 24, 0, 18, Math.floor((so.height - 48) / 18), 10, 5, Math.PI / 2);
  const rb = grow(RAM_BANK, 26);
  row(rb.x + rb.width, rb.y + 20, 0, 14, Math.floor((rb.height - 40) / 14), 6, 3, Math.PI / 2);
  row(rb.x + 30, rb.y + rb.height, 14, 0, Math.floor((rb.width - 60) / 14), 6, 3, 0);
  const pb = grow(POWER_BLOCK, 30);
  row(pb.x + pb.width, pb.y + 10, 0, 16, 7, 10, 5, Math.PI / 2);
  for (let c = 0; c < 400 && pads.length < 300; c++) {
    const p = { x: BOARD.x + 50 + r() * (BOARD.width - 100), y: BOARD.y + 50 + r() * (BOARD.height - 100) };
    if (KEEP_OUT.some((k) => inside(p, grow(k, 24)))) continue;
    const horiz = r() < 0.5;
    row(p.x, p.y, horiz ? 14 : 0, horiz ? 0 : 14, 3 + Math.floor(r() * 4), 8, 4, horiz ? 0 : Math.PI / 2);
  }

  // Silkscreen labels.
  labels.push({ p: { x: SOCKET.x, y: SOCKET.y - 44 }, text: 'CPU1  LGA-SCHED', size: 15 });
  labels.push({ p: { x: RAM_BANK.x, y: RAM_BANK.y - 12 }, text: 'DDR5  READY QUEUE  DIMM_A0-A7', size: 13 });
  for (let i = 0; i < RAM_SLOT_COUNT; i++) {
    const c = ramSlotCenter(i);
    labels.push({ p: { x: RAM_BANK.x + RAM_BANK.width + 8, y: c.y + 4 }, text: `A${i}`, size: 12 });
  }
  labels.push({ p: { x: STORAGE.x, y: STORAGE.y - 12 }, text: 'M.2_1  NVMe JOB POOL', size: 13 });
  labels.push({ p: { x: POWER_BLOCK.x, y: POWER_BLOCK.y + POWER_BLOCK.height + 26 }, text: 'VRM  12V  8+2 PHASE', size: 12 });
  labels.push({ p: { x: GANTT.x, y: GANTT.y - 12 }, text: 'LA1  CPU TIMELINE PROBE', size: 13 });
  labels.push({ p: { x: OUTPUT_PORT.x - 4, y: OUTPUT_PORT.y - 10 }, text: 'J1 RETIRE', size: 12 });
  labels.push({ p: { x: BOARD.x + BOARD.width - 330, y: BOARD.y + BOARD.height - 24 }, text: 'SCHED-MB  REV 2.0  ©2026', size: 14 });
  labels.push({ p: { x: STORAGE_EXIT.x + 14, y: STORAGE_EXIT.y - 8 }, text: 'PCIe x4', size: 10 });
  labels.push({ p: { x: BUS_X + 6, y: STORAGE_EXIT.y + 18 }, text: 'SYS BUS', size: 10, rot: -Math.PI / 2 });
  let ref = 101;
  for (const pd of pads) {
    if (r() < 0.12) labels.push({ p: { x: pd.p.x + 8, y: pd.p.y - 6 }, text: `${r() < 0.5 ? 'C' : 'R'}${ref++}`, size: 7 });
  }

  routingCache = { traces, vias, pads, labels };
  return routingCache;
}

// ------------------------------------------------------------------------------------------
// Drawing
// ------------------------------------------------------------------------------------------

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function drawPcb(ctx: CanvasRenderingContext2D, mode: Mode, k: number) {
  const R = routing();
  const g = rng(7);
  ctx.save();
  ctx.scale(k, k);

  // Base.
  if (mode === 'color') {
    const grad = ctx.createRadialGradient(CPU_CENTER.x, CPU_CENTER.y, 80, CPU_CENTER.x, CPU_CENTER.y, 1100);
    grad.addColorStop(0, '#125238');
    grad.addColorStop(1, '#0a3324');
    ctx.fillStyle = grad;
  } else ctx.fillStyle = mode === 'rough' ? '#5a5a5a' : '#808080';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Mask speckle.
  if (mode !== 'bump') {
    for (let i = 0; i < 26000; i++) {
      const v = g();
      ctx.fillStyle = mode === 'color' ? `rgba(${v < 0.5 ? '0,0,0' : '120,200,160'},${0.04 + g() * 0.05})` : `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},0.05)`;
      ctx.fillRect(g() * WORLD.width, g() * WORLD.height, 1.2, 1.2);
    }
  }

  // Copper under mask.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of R.traces) {
    ctx.lineWidth = t.w;
    if (mode === 'color') ctx.strokeStyle = t.kind === 'power' ? '#196343' : t.kind === 'bus' ? '#2b8a5a' : '#21744b';
    else if (mode === 'rough') ctx.strokeStyle = '#444';
    else ctx.strokeStyle = t.kind === 'power' ? '#a0a0a0' : '#b4b4b4';
    strokePath(ctx, t.pts);
    if (mode === 'color' && t.kind !== 'power') {
      ctx.lineWidth = Math.max(0.5, t.w * 0.35);
      ctx.strokeStyle = 'rgba(170,240,195,0.24)';
      strokePath(ctx, t.pts);
    }
  }

  // Exposed gold: vias, pads, mounting holes.
  const gold = mode === 'color' ? '#c9a24f' : mode === 'rough' ? '#2a2a2a' : '#c8c8c8';
  for (const v of R.vias) {
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(v.p.x, v.p.y, v.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mode === 'color' ? '#0a120e' : mode === 'rough' ? '#888' : '#505050';
    ctx.beginPath();
    ctx.arc(v.p.x, v.p.y, v.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pd of R.pads) {
    ctx.save();
    ctx.translate(pd.p.x, pd.p.y);
    ctx.rotate(pd.rot);
    ctx.fillStyle = mode === 'color' ? '#b8b8b0' : mode === 'rough' ? '#3a3a3a' : '#c0c0c0';
    ctx.fillRect(-pd.w / 2 - 2.5, -pd.h / 2, 2.5, pd.h);
    ctx.fillRect(pd.w / 2, -pd.h / 2, 2.5, pd.h);
    ctx.restore();
  }
  const holes: Point[] = [
    { x: BOARD.x + 22, y: BOARD.y + 22 },
    { x: BOARD.x + BOARD.width - 22, y: BOARD.y + 22 },
    { x: BOARD.x + 22, y: BOARD.y + BOARD.height - 22 },
    { x: BOARD.x + BOARD.width - 22, y: BOARD.y + BOARD.height - 22 },
    { x: CPU_CENTER.x + 520, y: BOARD.y + BOARD.height - 22 },
  ];
  for (const h of holes) {
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mode === 'color' ? '#050806' : mode === 'rough' ? '#aaa' : '#202020';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silkscreen.
  const silk = mode === 'color' ? '#e4efe8' : mode === 'rough' ? '#d0d0d0' : '#909090';
  ctx.strokeStyle = silk;
  ctx.fillStyle = silk;
  ctx.lineWidth = 1.6;
  for (const r of [grow(SOCKET, 18), grow(RAM_BANK, 6), grow(STORAGE, 8), grow(GANTT, 8), grow(POWER_BLOCK, 6)]) {
    ctx.strokeRect(r.x, r.y, r.width, r.height);
  }
  // Pin-1 triangle on the socket outline.
  const so = grow(SOCKET, 18);
  ctx.beginPath();
  ctx.moveTo(so.x, so.y);
  ctx.lineTo(so.x + 22, so.y);
  ctx.lineTo(so.x, so.y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  for (const l of R.labels) {
    ctx.save();
    ctx.translate(l.p.x, l.p.y);
    if (l.rot) ctx.rotate(l.rot);
    ctx.font = `600 ${l.size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

const cache = new Map<string, THREE.Texture>();

function finish(tex: THREE.CanvasTexture, srgb: boolean): THREE.CanvasTexture {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function pcbTexture(mode: Mode): THREE.Texture {
  const key = `pcb-${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = mode === 'color' ? 4096 : 2048;
  const k = w / WORLD.width;
  const [c, ctx] = canvas(w, Math.round(WORLD.height * k));
  drawPcb(ctx, mode, k);
  const tex = finish(new THREE.CanvasTexture(c), mode === 'color');
  cache.set(key, tex);
  return tex;
}

/** Silicon die: functional blocks, cache arrays and metal layers. */
export function dieTexture(): THREE.Texture {
  const hit = cache.get('die');
  if (hit) return hit;
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const g = rng(42);
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#1b1530');
  grad.addColorStop(0.5, '#122030');
  grad.addColorStop(1, '#201a14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  // Standard-cell rows.
  for (let y = 0; y < S; y += 3) {
    ctx.fillStyle = `rgba(${120 + g() * 80},${110 + g() * 80},${160 + g() * 60},${0.05 + g() * 0.06})`;
    ctx.fillRect(0, y, S, 1);
  }
  // Functional blocks.
  for (let i = 0; i < 46; i++) {
    const w = 40 + g() * 200;
    const h = 30 + g() * 160;
    const x = g() * (S - w);
    const y = g() * (S - h);
    ctx.fillStyle = `hsla(${200 + g() * 120},40%,${18 + g() * 14}%,0.55)`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(200,210,255,0.15)';
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    if (g() < 0.4) {
      // SRAM array texture.
      ctx.fillStyle = 'rgba(220,200,140,0.10)';
      for (let yy = y + 4; yy < y + h - 4; yy += 4) for (let xx = x + 4; xx < x + w - 4; xx += 4) ctx.fillRect(xx, yy, 2, 2);
    }
  }
  // Top metal straps.
  ctx.strokeStyle = 'rgba(230,200,150,0.12)';
  ctx.lineWidth = 3;
  for (let x = 16; x < S; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
  }
  const tex = finish(new THREE.CanvasTexture(c), true);
  cache.set('die', tex);
  return tex;
}

/** Laser-etched heat-spreader markings (alpha-like: dark marks on white). */
export function ihsTexture(): THREE.Texture {
  const hit = cache.get('ihs');
  if (hit) return hit;
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#7b7f86';
  ctx.font = '700 64px "Segoe UI", Arial, sans-serif';
  ctx.fillText('SCHED CORE X1', 120, 360);
  ctx.font = '500 40px "Consolas", "Courier New", monospace';
  ctx.fillText('FCFS · SJF · PRIO · RR', 120, 440);
  ctx.fillText('1C/1T  4.20GHz  TICK=1', 120, 500);
  ctx.fillText('SRL-2026  CAPSTONE OS', 120, 560);
  ctx.fillText('L524F801  e4', 120, 700);
  // 2D matrix code block.
  const g = rng(9);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (g() < 0.5 || x === 0 || y === 13) ctx.fillRect(740 + x * 10, 640 + y * 10, 10, 10);
  const tex = finish(new THREE.CanvasTexture(c), true);
  cache.set('ihs', tex);
  return tex;
}

/** Fine brushed-metal roughness pattern. */
export function brushedTexture(): THREE.Texture {
  const hit = cache.get('brushed');
  if (hit) return hit;
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const g = rng(3);
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2400; i++) {
    const y = g() * S;
    ctx.strokeStyle = `rgba(${g() < 0.5 ? 0 : 255},${g() < 0.5 ? 0 : 255},${g() < 0.5 ? 0 : 255},0.06)`;
    ctx.lineWidth = 0.6 + g();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + (g() - 0.5) * 4);
    ctx.stroke();
  }
  const tex = finish(new THREE.CanvasTexture(c), false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set('brushed', tex);
  return tex;
}

/** Package substrate with gold land-grid pads. */
export function substrateTexture(): THREE.Texture {
  const hit = cache.get('substrate');
  if (hit) return hit;
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#1f4d34';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#c8a24e';
  for (let y = 24; y < S - 16; y += 22) {
    for (let x = 24; x < S - 16; x += 22) {
      const edge = x < 170 || x > S - 190 || y < 170 || y > S - 190;
      if (edge) ctx.fillRect(x, y, 10, 10);
    }
  }
  ctx.fillStyle = '#d8d8d0';
  const g = rng(11);
  for (let i = 0; i < 40; i++) ctx.fillRect(200 + g() * 620, 200 + g() * 620, 14, 7);
  ctx.beginPath();
  ctx.fillStyle = '#e6c45a';
  ctx.moveTo(14, 14);
  ctx.lineTo(70, 14);
  ctx.lineTo(14, 70);
  ctx.fill();
  const tex = finish(new THREE.CanvasTexture(c), true);
  cache.set('substrate', tex);
  return tex;
}

/** Core floor-plan used as an emissive map: execution units, register file, pipeline lanes. */
export function coreTexture(): THREE.Texture {
  const hit = cache.get('core');
  if (hit) return hit;
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const g = rng(77);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, S, S);
  // Pipeline lanes.
  for (let i = 0; i < 6; i++) {
    const y = 40 + i * 74;
    ctx.fillStyle = `rgba(255,255,255,${0.18 + g() * 0.12})`;
    ctx.fillRect(28, y, S - 56, 30);
    for (let x = 34; x < S - 40; x += 18 + g() * 30) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + g() * 0.5})`;
      ctx.fillRect(x, y + 4, 8 + g() * 14, 22);
    }
  }
  // Fine grid.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= S; k += 16) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, S);
    ctx.moveTo(0, k);
    ctx.lineTo(S, k);
    ctx.stroke();
  }
  // Bright border ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, S - 12, S - 12);
  const tex = finish(new THREE.CanvasTexture(c), true);
  cache.set('core', tex);
  return tex;
}
