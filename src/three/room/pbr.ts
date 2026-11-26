// Photographic PBR textures (CC0, Poly Haven, 1k JPG) for the room. Each set has colour and normal maps, and
// roughness where a standard material uses it. Suspends until loaded. Clones share the decoded image and are
// cached per tiling, so a set used twice is uploaded to the GPU once.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

export type PbrName = 'stretch_poplin' | 'brown_planks_03' | 'plastered_wall_02' | 'dark_wood' | 'rough_linen';

export interface Pbr {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

const BASE = `${import.meta.env.BASE_URL}assets/tex/`;

/** Names that ship a roughness map (only standard materials read it). */
const HAS_ROUGH: ReadonlySet<PbrName> = new Set(['dark_wood']);

const grays = new Map<string, THREE.Texture>();
const tiles = new Map<string, THREE.Texture>();

/** Luminance-only copy of a colour texture, normalised to a mean of 0.8, so a tint colour sets the real hue. */
function grayscale(name: string, src: THREE.Texture): THREE.Texture {
  const hit = grays.get(name);
  if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114;
    px[i] = l;
    sum += l;
  }
  const k = (0.8 * 255) / (sum / (px.length / 4));
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, px[i]! * k);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  grays.set(name, t);
  return t;
}

function tile(key: string, src: THREE.Texture, rx: number, ry: number, srgb: boolean): THREE.Texture {
  const hit = tiles.get(key);
  if (hit) return hit;
  const t = src.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  tiles.set(key, t);
  return t;
}

/** One texture set, tiled rx x ry times across the UV range of the mesh it is used on. */
export function usePbr(name: PbrName, rx: number, ry: number, gray = false): Pbr {
  const rough = HAS_ROUGH.has(name);
  const files = [`${BASE}${name}/diff.jpg`, `${BASE}${name}/nor.jpg`, ...(rough ? [`${BASE}${name}/rough.jpg`] : [])];
  const [d, n, r] = useTexture(files);
  return useMemo(() => {
    const k = `${name}|${rx}|${ry}|${gray}`;
    const set: Pbr = {
      map: tile(`${k}|d`, gray ? grayscale(name, d!) : d!, rx, ry, true),
      normalMap: tile(`${k}|n`, n!, rx, ry, false),
    };
    if (rough && r) set.roughnessMap = tile(`${k}|r`, r, rx, ry, false);
    return set;
  }, [name, rx, ry, gray, rough, d, n, r]);
}
