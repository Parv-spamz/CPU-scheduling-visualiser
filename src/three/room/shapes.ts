// Soft, organic shapes for the room: pillows, pleated curtains, a lathed vase. Built once, no per-frame cost.
import * as THREE from 'three';

/**
 * A stuffed pillow: a rectangular cushion whose thickness fades to a seam at the edges, pinched at the corners,
 * with a soft dip in the middle and small ripples along the seam.
 */
export function pillowGeometry(w: number, h: number, d: number, seed = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 40, 12, 28);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / (w / 2);
    const ny = v.y / (h / 2);
    const nz = v.z / (d / 2);
    const px = Math.abs(nx) ** 3.2;
    const pz = Math.abs(nz) ** 3.2;
    const t = Math.pow(Math.max(0, 1 - px), 0.55) * Math.pow(Math.max(0, 1 - pz), 0.55);
    const edge = Math.max(px, pz);
    const ripple = 1 + 0.07 * edge * Math.sin((nx + nz) * 11 + seed * 2.3);
    const dip = 1 - 0.1 * Math.exp(-(nx * nx + nz * nz) * 2.4);
    const x = v.x * (1 - 0.03 * pz);
    const z = v.z * (1 - 0.05 * px);
    pos.setXYZ(i, x, ny * (h / 2) * t * ripple * (ny > 0 ? dip : 1), z);
  }
  g.computeVertexNormals();
  return g;
}

/** A pleated curtain: a plane whose depth follows a sine, so folds catch the light. */
export function curtainGeometry(width: number, height: number, folds: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, folds * 8, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / width) * Math.PI * 2 * folds) * 0.42);
  }
  g.computeVertexNormals();
  return g;
}

/** A ceramic vase turned on a lathe. */
export function vaseGeometry(): THREE.BufferGeometry {
  const pts = [
    [0, 0],
    [1.4, 0],
    [1.75, 0.5],
    [2.1, 1.6],
    [2.0, 2.8],
    [1.35, 3.8],
    [0.95, 4.5],
    [1.05, 5.0],
    [0.95, 5.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
}

/**
 * A duvet: a rounded slab with proper 0..1 UVs (so the baked texture maps across the whole top) and a
 * soft undulation that grows away from the middle, where the board lies flat.
 */
export function duvetGeometry(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 56, 2, 64);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(Math.max(-inner.x, Math.min(inner.x, v.x)), Math.max(-inner.y, Math.min(inner.y, v.y)), Math.max(-inner.z, Math.min(inner.z, v.z)));
    const n = v.clone().sub(c);
    if (n.lengthSq() > 1e-9) v.copy(c).add(n.normalize().multiplyScalar(r));
    if (v.y > 0) {
      const dist = Math.hypot(v.x, v.z - 1);
      const k = Math.min(1, Math.max(0, (dist - 9) / 12));
      const wave = Math.sin(v.x * 0.42 + 1.3) * Math.cos(v.z * 0.31) + 0.6 * Math.sin(v.x * 0.9 - v.z * 0.7);
      v.y -= k * (0.35 + 0.28 * wave);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
