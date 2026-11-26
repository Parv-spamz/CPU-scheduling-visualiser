import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Process } from '../../engine/types';
import { CHIP_HEIGHT, chipWidth } from '../../scene/layout';
import { useApp } from '../../store/useApp';
import { rt } from '../../player/runtime';
import type { Place } from '../../player/keyframes';
import { chipFrameAt, restingPlaceAt } from '../../player/sceneState';
import { CPU_STACK, H, PLACE_HEIGHT, mm, toX, toZ } from '../kit/space';
import { radialGlowTexture } from '../kit/materials';
import { describeProcess } from './describe';

const RADIUS = mm(CHIP_HEIGHT / 2);

function baseHeight(place: Place): number {
  switch (place.kind) {
    case 'storage':
      return PLACE_HEIGHT.storage;
    case 'slot':
      return PLACE_HEIGHT.slot;
    case 'core':
      return THREE.MathUtils.lerp(CPU_STACK.ihsTop + mm(0.4), CPU_STACK.dieTop + mm(0.4), rt.ihsLift);
    case 'done':
      return PLACE_HEIGHT.done;
  }
}

const RETURN_RED = new THREE.Color('#ff3b2a');

/**
 * A process as a packet of light. It is visible while it waits on the SSD and while it travels;
 * in the ready queue it becomes a lit segment of a memory module, and on the CPU it becomes the core glow.
 */
function Packet({ p }: { p: Process }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const setTooltip = useApp((s) => s.setTooltip);
  const selectPid = useApp((s) => s.selectPid);
  const len = mm(chipWidth(p.burst));
  const colour = useMemo(() => new THREE.Color(p.color), [p.color]);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const last = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const g = group.current;
    const plan = rt.plan;
    if (!g || !plan) return;
    const f = chipFrameAt(plan, p.pid, rt.sec);
    const place = f.move ? f.move.to : restingPlaceAt(plan, p.pid, rt.sec);
    const resting = !f.move;
    // In the queue or on the core the hardware shows the process, so the packet itself hides.
    const shown = f.pose.opacity > 0.01 && (!resting || place.kind === 'storage');
    g.visible = shown;
    if (!shown) return;

    let y: number;
    if (f.move) {
      const e = f.u < 0.5 ? 2 * f.u * f.u : 1 - Math.pow(-2 * f.u + 2, 2) / 2;
      y = THREE.MathUtils.lerp(baseHeight(f.move.from), baseHeight(f.move.to), e) + Math.sin(Math.PI * f.u) * H.chipHover;
    } else y = baseHeight(place);
    last.copy(g.position);
    g.position.set(toX(f.pose.x), y + RADIUS * f.pose.scale, toZ(f.pose.y));
    g.scale.setScalar(Math.max(0.001, f.pose.scale));
    // Point along the direction of travel; lie along the board's x axis at rest.
    dir.subVectors(g.position, last);
    if (f.move && dir.lengthSq() > 1e-10) g.rotation.y = Math.atan2(-dir.z, dir.x);
    else if (resting) g.rotation.y = 0;

    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4 + p.pid);
    const preempted = f.move?.kind === 'return';
    if (body.current) {
      body.current.emissive.copy(preempted ? RETURN_RED : colour);
      body.current.emissiveIntensity = (f.move ? 3.2 : 1.6 + pulse * 0.5) * f.pose.opacity;
      body.current.opacity = f.pose.opacity;
    }
    if (halo.current) halo.current.opacity = (f.move ? 0.9 : 0.5) * f.pose.opacity;
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    const run = rt.run;
    if (run) setTooltip(describeProcess(run, p, rt.t));
  };
  const onOut = () => {
    document.body.style.cursor = '';
    if (useApp.getState().selectedPid !== p.pid) setTooltip('');
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    selectPid(p.pid);
    const run = rt.run;
    if (run) setTooltip(describeProcess(run, p, rt.t));
  };

  return (
    <group ref={group} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <mesh rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[RADIUS, Math.max(0.001, len - RADIUS * 2), 6, 16]} />
        <meshStandardMaterial ref={body} color={p.color} emissive={p.color} emissiveIntensity={2} roughness={0.3} transparent toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -RADIUS + 0.0005, 0]}>
        <planeGeometry args={[len * 2.2, mm(10)]} />
        <meshBasicMaterial ref={halo} map={radialGlowTexture()} color={p.color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Every process as a light packet whose pose is a pure function of the playback clock. */
export default function Packets() {
  const run = useApp((s) => s.run);
  if (!run) return null;
  return (
    <group>
      {run.processes.map((p) => (
        <Packet key={`${p.pid}-${p.burst}-${p.color}`} p={p} />
      ))}
    </group>
  );
}

