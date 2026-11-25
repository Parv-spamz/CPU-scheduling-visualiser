import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Process, RunResult } from '../engine/types';
import { CHIP_HEIGHT, chipWidth } from '../scene/layout';
import { useApp } from '../store/useApp';
import { rt } from '../player/runtime';
import type { Place } from '../player/keyframes';
import { chipFrameAt, remainingAt, restingPlaceAt } from '../player/sceneState';
import { CPU_STACK, FONT_SIZE, H, U, toX, toZ } from './space';
import { FONTS } from './fonts';
import { COLORS, damp, radialGlowTexture } from './materials';

const DEPTH = CHIP_HEIGHT * U;
const PIN_PITCH = 0.05;
const NAME_FAR = 15;
const NAME_NEAR = 12.5;
const DETAIL_FAR = 9;
const DETAIL_NEAR = 7;

type TextMesh = THREE.Mesh & { fillOpacity: number };

function baseHeight(place: Place): number {
  switch (place.kind) {
    case 'storage':
      return H.storageFloor;
    case 'slot':
      return H.ramSlot;
    case 'core':
      return THREE.MathUtils.lerp(CPU_STACK.ihsTop + 0.004, CPU_STACK.dieTop + 0.016, rt.ihsLift);
    case 'done':
      return 0.22;
  }
}

function describe(run: RunResult, p: Process, t: number): string {
  const rem = remainingAt(run, p.pid, t);
  const base = `${p.name} · arrival ${p.arrival} · burst ${p.burst} · priority ${p.priority} · remaining ${rem}`;
  const r = run.perProcess.find((x) => x.pid === p.pid);
  if (r && t >= r.completion) return `${base} · done at ${r.completion} · waited ${r.waiting} · turnaround ${r.turnaround} · response ${r.response}`;
  return base;
}

interface ChipProps {
  process: Process;
  remaining: number;
}

function Chip({ process: p, remaining }: ChipProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshPhysicalMaterial>(null);
  const stripe = useRef<THREE.MeshStandardMaterial>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const pinsMat = useRef<THREE.MeshStandardMaterial>(null);
  const pins = useRef<THREE.InstancedMesh>(null);
  const name = useRef<TextMesh>(null);
  const detail = useRef<TextMesh>(null);
  const shadow = useRef<THREE.MeshBasicMaterial>(null);
  const camera = useThree((s) => s.camera);
  const setTooltip = useApp((s) => s.setTooltip);
  const selectPid = useApp((s) => s.selectPid);

  const w = chipWidth(p.burst) * U;
  const pinCount = Math.max(2, Math.floor((w - 0.08) / PIN_PITCH));
  const colour = useMemo(() => new THREE.Color(p.color), [p.color]);
  const ledColour = useMemo(() => new THREE.Color(), []);
  const world = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const mesh = pins.current;
    if (!mesh) return;
    const span = (pinCount - 1) * PIN_PITCH;
    for (let i = 0; i < pinCount; i++) {
      const x = -span / 2 + i * PIN_PITCH;
      m.makeTranslation(x, -H.chip * 0.3, -DEPTH / 2 - 0.018);
      mesh.setMatrixAt(i * 2, m);
      m.makeTranslation(x, -H.chip * 0.3, DEPTH / 2 + 0.018);
      mesh.setMatrixAt(i * 2 + 1, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [pinCount]);

  useFrame((state, dt) => {
    const g = group.current;
    const plan = rt.plan;
    if (!g || !plan) return;
    const f = chipFrameAt(plan, p.pid, rt.sec);
    const place = f.move ? f.move.to : restingPlaceAt(plan, p.pid, rt.sec);
    const op = f.pose.opacity;
    g.visible = op > 0.01;
    if (!g.visible) return;

    let y: number;
    if (f.move) {
      const e = f.u < 0.5 ? 2 * f.u * f.u : 1 - Math.pow(-2 * f.u + 2, 2) / 2;
      y = THREE.MathUtils.lerp(baseHeight(f.move.from), baseHeight(f.move.to), e) + Math.sin(Math.PI * f.u) * H.chipHover;
    } else y = baseHeight(place);
    g.position.set(toX(f.pose.x), y + (H.chip * f.pose.scale) / 2, toZ(f.pose.y));
    g.scale.setScalar(f.pose.scale);
    // A little banking while travelling.
    g.rotation.z = f.move ? Math.sin(Math.PI * f.u) * 0.08 : 0;

    // Contact shadow: strongest when resting, fades while the chip is lifted in transit.
    if (shadow.current) shadow.current.opacity = op * 0.55 * (f.move ? 1 - Math.sin(Math.PI * f.u) * 0.8 : 1);

    const transparent = op < 0.999;
    for (const m of [body.current, stripe.current, pinsMat.current]) {
      if (!m) continue;
      m.transparent = transparent;
      m.opacity = op;
    }

    // State colour: red while being preempted, green on retire, bright while running on the core.
    const preempting = f.move?.kind === 'return';
    const retiring = f.move?.kind === 'exit' || place.kind === 'done';
    const onCore = !f.move && place.kind === 'core';
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 7);
    if (preempting) ledColour.copy(COLORS.hot).multiplyScalar(3 + pulse * 2);
    else if (retiring) ledColour.copy(COLORS.ok).multiplyScalar(3.2);
    else ledColour.copy(colour).multiplyScalar(onCore ? 3.4 : 1.4);
    if (led.current) {
      led.current.color.copy(ledColour);
      led.current.opacity = op;
    }
    if (stripe.current) {
      stripe.current.emissive.copy(preempting ? COLORS.hot : colour);
      stripe.current.emissiveIntensity = damp(stripe.current.emissiveIntensity, onCore ? 2.6 + pulse : preempting ? 2.2 : 0.7, 10, dt);
    }

    // Level of detail by camera distance.
    g.getWorldPosition(world);
    const d = camera.position.distanceTo(world);
    if (name.current) name.current.fillOpacity = op * THREE.MathUtils.smoothstep(NAME_FAR - d, 0, NAME_FAR - NAME_NEAR);
    if (detail.current) detail.current.fillOpacity = op * THREE.MathUtils.smoothstep(DETAIL_FAR - d, 0, DETAIL_FAR - DETAIL_NEAR);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    const run = rt.run;
    if (run) setTooltip(describe(run, p, rt.t));
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
    if (run) setTooltip(describe(run, p, rt.t));
  };

  return (
    <group ref={group} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <mesh position={[0, -H.chip / 2 + 0.002, 0]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[w * 1.5, DEPTH * 2.4]} />
        <meshBasicMaterial ref={shadow} map={radialGlowTexture()} color="#000000" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <RoundedBox args={[w, H.chip, DEPTH]} radius={0.012} smoothness={3} receiveShadow>
        <meshPhysicalMaterial ref={body} color="#121314" roughness={0.38} clearcoat={0.5} clearcoatRoughness={0.35} />
      </RoundedBox>
      {/* Colour stripe along the leading edge: the process's identity everywhere it goes. */}
      <mesh position={[0, H.chip / 2 + 0.0015, -DEPTH / 2 + 0.035]}>
        <boxGeometry args={[w - 0.04, 0.003, 0.03]} />
        <meshStandardMaterial ref={stripe} color={p.color} emissive={p.color} emissiveIntensity={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[-w / 2 + 0.04, H.chip / 2 + 0.002, DEPTH / 2 - 0.045]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial ref={led} toneMapped={false} transparent />
      </mesh>
      <instancedMesh ref={pins} args={[undefined, undefined, pinCount * 2]}>
        <boxGeometry args={[0.018, 0.02, 0.036]} />
        <meshStandardMaterial ref={pinsMat} color="#d9b25e" metalness={1} roughness={0.25} />
      </instancedMesh>
      <Text
        ref={name}
        font={FONTS.monoBold}
        fontSize={FONT_SIZE.chip}
        position={[0, H.chip / 2 + 0.003, 0.02]}
        rotation-x={-Math.PI / 2}
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        letterSpacing={0.04}
      >
        {p.name}
        <meshBasicMaterial color={[1.6, 1.65, 1.7]} toneMapped={false} transparent />
      </Text>
      <Text
        ref={detail}
        font={FONTS.mono}
        fontSize={FONT_SIZE.small * 0.62}
        position={[w / 2 - 0.03, H.chip / 2 + 0.003, DEPTH / 2 - 0.04]}
        rotation-x={-Math.PI / 2}
        anchorX="right"
        anchorY="middle"
        fillOpacity={0}
      >
        {`rem ${remaining}/${p.burst} · pr ${p.priority}`}
        <meshBasicMaterial color={[1.1, 1.1, 1.1]} toneMapped={false} transparent />
      </Text>
    </group>
  );
}

/** Every process as a physical chip whose pose is a pure function of the playback clock. */
export default function Chips() {
  const run = useApp((s) => s.run);
  const tick = useApp((s) => s.playhead.clock);
  if (!run) return null;
  return (
    <group>
      {run.processes.map((p) => (
        <Chip key={`${p.pid}-${p.burst}-${p.color}`} process={p} remaining={remainingAt(run, p.pid, Math.floor(tick))} />
      ))}
    </group>
  );
}
