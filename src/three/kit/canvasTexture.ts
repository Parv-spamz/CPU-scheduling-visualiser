// Shared helpers for procedural canvas textures (no image assets, no network).
import * as THREE from 'three';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

export const cache = new Map<string, THREE.Texture>();

export function finish(tex: THREE.CanvasTexture, srgb: boolean): THREE.CanvasTexture {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
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
