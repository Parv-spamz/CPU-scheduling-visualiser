// CPU textures: die floorplan, heat-spreader etching, package substrate and core floorplan.
import * as THREE from 'three';
import { cache, canvas, finish, rng } from '../kit/canvasTexture';

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

/** Laser-etched heat-spreader marking: a 2D matrix code only (no text). */
export function ihsTexture(): THREE.Texture {
  const hit = cache.get('ihs');
  if (hit) return hit;
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#7b7f86';
  // 2D matrix code block.
  const g = rng(9);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (g() < 0.5 || x === 0 || y === 13) ctx.fillRect(740 + x * 10, 640 + y * 10, 10, 10);
  const tex = finish(new THREE.CanvasTexture(c), true);
  cache.set('ihs', tex);
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
