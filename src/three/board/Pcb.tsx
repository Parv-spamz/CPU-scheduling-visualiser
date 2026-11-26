import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOARD, WORLD } from '../../scene/layout';
import { H, U, mm, toX, toZ } from '../kit/space';
import { pcbTexture, routing, type Smd } from './pcbTexture';

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

const PART = {
  res: { h: 0.45, color: '#141516', rough: 0.5 },
  cap: { h: 0.8, color: '#8a6d4c', rough: 0.55 },
  ic: { h: 1.1, color: '#151617', rough: 0.42 },
} as const;

/** One instanced mesh per SMD kind: resistors, ceramic capacitors and small ICs. */
function SmdKind({ list, kind }: { list: Smd[]; kind: keyof typeof PART }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    list.forEach((s, i) => {
      e.set(0, -s.rot, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(toX(s.p.x), mm(PART[kind].h) / 2, toZ(s.p.y)), q, new THREE.Vector3(s.w * U, mm(PART[kind].h), s.h * U));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [list, kind]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={PART[kind].color} roughness={PART[kind].rough} metalness={kind === 'ic' ? 0.1 : 0} />
    </instancedMesh>
  );
}

/** The bare board: laminate edge, solder-mask top with copper and silkscreen, and SMD parts. */
export default function Pcb() {
  const shape = useMemo(() => boardShape(), []);
  const smd = routing().smd;
  const split = useMemo(
    () => ({ res: smd.filter((s) => s.kind === 'res'), cap: smd.filter((s) => s.kind === 'cap'), ic: smd.filter((s) => s.kind === 'ic') }),
    [smd],
  );

  const top = useMemo(() => {
    const g = new THREE.ShapeGeometry(shape, 8);
    // UVs in world texture space: u = x / width, v = 1 - y / height.
    const pos = g.attributes.position!;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) / U + WORLD.width / 2;
      const ly = -pos.getY(i) / U + WORLD.height / 2;
      uv[i * 2] = lx / WORLD.width;
      uv[i * 2 + 1] = 1 - ly / WORLD.height;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [shape]);

  const edge = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: H.pcb, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -H.pcb - 0.0008, 0);
    return g;
  }, [shape]);

  const maps = useMemo(() => ({ color: pcbTexture('color'), rough: pcbTexture('rough'), bump: pcbTexture('bump'), emit: pcbTexture('emit') }), []);

  return (
    <group>
      {/* FR-4 core: the board edge shows the fibreglass laminate between the black mask layers. */}
      <mesh geometry={edge} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3a2c" roughness={0.75} />
      </mesh>
      <mesh geometry={top} receiveShadow>
        <meshStandardMaterial
          map={maps.color}
          roughnessMap={maps.rough}
          roughness={0.9}
          bumpMap={maps.bump}
          bumpScale={0.9}
          emissiveMap={maps.emit}
          emissive="#ffffff"
          emissiveIntensity={0.38}
          metalness={0.05}
          envMapIntensity={0.8}
        />
      </mesh>
      <SmdKind list={split.res} kind="res" />
      <SmdKind list={split.cap} kind="cap" />
      <SmdKind list={split.ic} kind="ic" />
    </group>
  );
}
