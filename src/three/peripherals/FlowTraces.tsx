import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RAM_SLOT_COUNT, TRACE_CPU_OUT, traceSlotToCpu, traceStorageToSlot, type Point } from '../../scene/layout';
import { rt } from '../../player/runtime';
import type { MoveKind } from '../../player/keyframes';
import { mm, toX, toZ } from '../kit/space';
import { damp, flowMaterial } from '../kit/materials';

const WIDTH = mm(0.7);
const Y = mm(0.06);

/** Flat ribbon along a polyline with per-vertex arc length (aLen) and side (-1..1). */
function ribbon(paths: Point[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const len: number[] = [];
  const side: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const path of paths) {
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const a = { x: toX(path[i - 1].x), z: toZ(path[i - 1].y) };
      const b = { x: toX(path[i].x), z: toZ(path[i].y) };
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (l === 0) continue;
      const nx = (-(b.z - a.z) / l) * (WIDTH / 2);
      const nz = ((b.x - a.x) / l) * (WIDTH / 2);
      pos.push(a.x + nx, Y, a.z + nz, a.x - nx, Y, a.z - nz, b.x + nx, Y, b.z + nz, b.x - nx, Y, b.z - nz);
      len.push(acc, acc, acc + l, acc + l);
      side.push(1, -1, 1, -1);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      base += 4;
      acc += l;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(len, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

function activeKinds(sec: number): Set<MoveKind> {
  const out = new Set<MoveKind>();
  const plan = rt.plan;
  if (!plan) return out;
  for (const moves of plan.moves.values()) {
    for (const m of moves) {
      if (m.start > sec) break;
      if (sec <= m.start + m.duration) out.add(m.kind);
    }
  }
  return out;
}

/** Glowing bus traces that carry light pulses; they brighten while a chip travels on them. */
export default function FlowTraces() {
  const geo = useMemo(
    () => ({
      inbound: ribbon(Array.from({ length: RAM_SLOT_COUNT }, (_, i) => traceStorageToSlot(i))),
      dispatch: ribbon(Array.from({ length: RAM_SLOT_COUNT }, (_, i) => traceSlotToCpu(i))),
      out: ribbon([TRACE_CPU_OUT]),
    }),
    [],
  );
  const mats = useMemo(
    () => ({ inbound: flowMaterial('#ffb347'), dispatch: flowMaterial('#38e8ff'), out: flowMaterial('#57ff8a') }),
    [],
  );

  useFrame((state, dt) => {
    const kinds = activeKinds(rt.sec);
    const t = state.clock.elapsedTime;
    const set = (m: THREE.ShaderMaterial, on: boolean) => {
      m.uniforms.uTime.value = t;
      m.uniforms.uActive.value = damp(m.uniforms.uActive.value, on ? 1 : 0, 6, dt);
    };
    set(mats.inbound, kinds.has('arrive'));
    set(mats.dispatch, kinds.has('dispatch') || kinds.has('return'));
    set(mats.out, kinds.has('exit'));
  });

  return (
    <group renderOrder={2}>
      <mesh geometry={geo.inbound} material={mats.inbound} />
      <mesh geometry={geo.dispatch} material={mats.dispatch} />
      <mesh geometry={geo.out} material={mats.out} />
    </group>
  );
}

