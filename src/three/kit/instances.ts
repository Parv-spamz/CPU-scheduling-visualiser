import { useLayoutEffect } from 'react';
import * as THREE from 'three';

export interface Placement {
  pos: THREE.Vector3;
  scale: THREE.Vector3;
  rotY?: number;
  rotX?: number;
}

/** Fill an instanced mesh from a list of placements (position, scale, optional rotation). */
export function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, list: Placement[]): void {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    list.forEach((p, i) => {
      e.set(p.rotX ?? 0, p.rotY ?? 0, 0);
      q.setFromEuler(e);
      m.compose(p.pos, q, p.scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, list]);
}

/** Shorthand for a placement from world position and size. */
export function place(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): Placement {
  return { pos: new THREE.Vector3(x, y, z), scale: new THREE.Vector3(sx, sy, sz), rotY };
}
