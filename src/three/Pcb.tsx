import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOARD, WORLD } from '../scene/layout';
import { H, U, toX, toZ } from './space';
import { KEEP_OUT, brushedTexture, pcbTexture, routing } from './textures';

/** Rounded board outline in plane coordinates (X right, Y = -Z), ready for rotateX(-PI/2). */
function boardShape(): THREE.Shape {
  const r = BOARD.radius;
  const x0 = BOARD.x;
  const y0 = BOARD.y;
  const x1 = BOARD.x + BOARD.width;
  const y1 = BOARD.y + BOARD.height;
  const P = (x: number, y: number): [number, number] => [toX(x), -toZ(y)];
  const s = new THREE.Shape();
  s.moveTo(...P(x0 + r, y0));
  s.lineTo(...P(x1 - r, y0));
  s.quadraticCurveTo(...P(x1, y0), ...P(x1, y0 + r));
  s.lineTo(...P(x1, y1 - r));
  s.quadraticCurveTo(...P(x1, y1), ...P(x1 - r, y1));
  s.lineTo(...P(x0 + r, y1));
  s.quadraticCurveTo(...P(x0, y1), ...P(x0, y1 - r));
  s.lineTo(...P(x0, y0 + r));
  s.quadraticCurveTo(...P(x0, y0), ...P(x0 + r, y0));
  return s;
}

const BEVEL = 0.01;

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

/** SMD parts on the routing pads: tiny resistors and MLCC capacitors as instanced boxes. */
function SmdParts() {
  const pads = routing().pads;
  const resRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const split = useMemo(() => {
    const r = rng(5);
    const res: typeof pads = [];
    const cap: typeof pads = [];
    for (const p of pads) (r() < 0.55 ? res : cap).push(p);
    return { res, cap };
  }, [pads]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const fill = (mesh: THREE.InstancedMesh | null, list: typeof pads) => {
      if (!mesh) return;
      list.forEach((p, i) => {
        e.set(0, p.rot, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(toX(p.p.x), 0.012, toZ(p.p.y)), q, new THREE.Vector3(p.w * U, 0.024, p.h * U * 1.4));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    fill(resRef.current, split.res);
    fill(capRef.current, split.cap);
  }, [split]);

  return (
    <>
      <instancedMesh ref={resRef} args={[undefined, undefined, split.res.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#121212" roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, split.cap.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#9b7a52" roughness={0.6} />
      </instancedMesh>
    </>
  );
}

/** A few support ICs (BIOS, controllers) in free board areas. */
function SupportChips() {
  const chips = useMemo(() => {
    const r = rng(314);
    const out: { x: number; y: number; w: number; d: number }[] = [];
    for (let i = 0; i < 600 && out.length < 7; i++) {
      const w = 40 + r() * 40;
      const d = 30 + r() * 30;
      const x = BOARD.x + 60 + r() * (BOARD.width - 120);
      const y = BOARD.y + 60 + r() * (BOARD.height - 120);
      const rect = { x: x - w / 2 - 20, y: y - d / 2 - 20, width: w + 40, height: d + 40 };
      const hit = [...KEEP_OUT, ...out.map((o) => ({ x: o.x - o.w, y: o.y - o.d, width: o.w * 2, height: o.d * 2 }))].some(
        (k) => rect.x < k.x + k.width && rect.x + rect.width > k.x && rect.y < k.y + k.height && rect.y + rect.height > k.y,
      );
      if (!hit) out.push({ x, y, w, d });
    }
    return out;
  }, []);
  return (
    <>
      {chips.map((c, i) => (
        <group key={i} position={[toX(c.x), 0, toZ(c.y)]}>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[c.w * U, 0.05, c.d * U]} />
            <meshPhysicalMaterial color="#141516" roughness={0.42} clearcoat={0.3} clearcoatRoughness={0.5} />
          </mesh>
          <mesh position={[0, 0.006, 0]}>
            <boxGeometry args={[c.w * U + 0.06, 0.012, c.d * U - 0.04]} />
            <meshStandardMaterial color="#c9c9c2" metalness={1} roughness={0.32} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function Pcb() {
  const shape = useMemo(() => boardShape(), []);

  const top = useMemo(() => {
    const g = new THREE.ShapeGeometry(shape, 12);
    // UVs in world texture space: u = x / 1600, v = 1 - y / 1000.
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i);
      const Yp = pos.getY(i);
      const lx = X / U + WORLD.width / 2;
      const ly = -Yp / U + WORLD.height / 2;
      uv[i * 2] = lx / WORLD.width;
      uv[i * 2 + 1] = 1 - ly / WORLD.height;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [shape]);

  const edge = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: H.pcb, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 2, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    // Extrusion spans [-bevel, depth + bevel]; keep its top cap just under the textured surface.
    g.translate(0, -H.pcb - BEVEL - 0.002, 0);
    return g;
  }, [shape]);

  const maps = useMemo(() => ({ color: pcbTexture('color'), rough: pcbTexture('rough'), bump: pcbTexture('bump') }), []);
  const brushed = useMemo(() => brushedTexture(), []);

  return (
    <group>
      <mesh geometry={edge} castShadow receiveShadow>
        <meshStandardMaterial color="#0b1f17" roughness={0.6} roughnessMap={brushed} />
      </mesh>
      <mesh geometry={top} position={[0, 0.0015, 0]} receiveShadow>
        <meshPhysicalMaterial
          map={maps.color}
          roughnessMap={maps.rough}
          roughness={1}
          bumpMap={maps.bump}
          bumpScale={1.4}
          metalness={0.05}
          clearcoat={0.4}
          clearcoatRoughness={0.38}
          envMapIntensity={0.7}
        />
      </mesh>
      <SmdParts />
      <SupportChips />
    </group>
  );
}
