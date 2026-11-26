import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../../store/useApp';
import {
  CORE,
  CORE_PROGRESS_RADIUS,
  CPU_CENTER,
  DIE,
  IHS_SIZE,
  ILM,
  PACKAGE_SIZE,
  QUANTUM_RING_RADIUS,
  RING_STROKE,
  SCHEDULER,
  SOCKET_SIZE,
} from '../../scene/layout';
import { rt } from '../../player/runtime';
import { coreFrameAt, sinceLast } from '../../player/sceneState';
import { CPU_STACK, H, at, mm, rectCenter, rectSize, toZ } from '../kit/space';
import { COLORS, arcRingMaterial, damp, radialGlowTexture } from '../kit/materials';
import { brushedTexture } from '../kit/canvasTexture';
import { coreTexture, dieTexture, ihsTexture, substrateTexture } from './cpuTextures';

const tmp = new THREE.Color();
const STEEL = { color: '#c2c6cb', metalness: 1, roughness: 0.34 } as const;
/** How far back the lifted heat spreader drifts (world units). */
const IHS_SLIDE = mm(46);

function setCursor(on: boolean) {
  document.body.style.cursor = on ? 'pointer' : '';
}

/**
 * LGA socket with its loading mechanism, the CPU package, the die and the scheduled core.
 * At the CPU and core levels the load plate swings open and the heat spreader lifts away to show the die.
 */
export default function Socket() {
  const settings = useApp((s) => s.run?.settings ?? s.settings);
  const setLevel = useApp((s) => s.setLevel);

  const plate = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const ihs = useRef<THREE.Group>(null);
  const ihsMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const schedFlashMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);

  const progressMat = useMemo(() => arcRingMaterial('#ffffff'), []);
  const quantumMat = useMemo(() => arcRingMaterial('#ffc94d'), []);
  const tex = useMemo(() => ({ die: dieTexture(), ihs: ihsTexture(), sub: substrateTexture(), brushed: brushedTexture(), core: coreTexture() }), []);

  const c = at(CPU_CENTER);
  const die = rectSize(DIE);
  const core = rectSize(CORE);
  const coreC = rectCenter(CORE);
  const sched = rectSize(SCHEDULER);
  const schedC = rectCenter(SCHEDULER, CPU_STACK.dieTop + mm(0.05));
  const ilm = rectSize(ILM);
  const hingeZ = toZ(ILM.y);

  useFrame((state, dt) => {
    const s = useApp.getState();
    const target = s.level === 'L1' || s.level === 'L2' ? 1 : 0;
    const lift = damp(rt.ihsLift, target, s.reducedMotion ? 12 : 3, dt);
    rt.ihsLift = lift;
    // Sequence: lever up (0..0.35), load plate opens (0.15..0.6), heat spreader lifts (0.45..1).
    const leverT = THREE.MathUtils.smoothstep(lift, 0, 0.35);
    const plateT = THREE.MathUtils.smoothstep(lift, 0.15, 0.6);
    const ihsT = THREE.MathUtils.smoothstep(lift, 0.45, 1);
    if (lever.current) lever.current.rotation.x = -leverT * 1.7;
    if (plate.current) plate.current.rotation.x = -plateT * 1.95;
    if (ihs.current && ihsMat.current) {
      ihs.current.position.set(0, ihsT * H.ihsLift, -ihsT * IHS_SLIDE);
      ihs.current.rotation.x = -ihsT * 0.45;
      const fade = 1 - THREE.MathUtils.smoothstep(ihsT, 0.55, 0.95);
      ihs.current.visible = fade > 0.02;
      ihsMat.current.opacity = fade;
      ihsMat.current.transparent = fade < 0.99;
      ihsMat.current.depthWrite = fade >= 0.99;
    }

    const hot = THREE.MathUtils.smoothstep(rt.load, 0.45, 1);
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * (3 + hot * 5));
    const run = rt.run;
    const plan = rt.plan;
    const frame = run ? coreFrameAt(run, rt.t, settings.quantum) : null;
    const pid = frame?.segment?.pid ?? null;
    const proc = pid !== null ? run?.processes.find((p) => p.pid === pid) : undefined;
    const running = !!proc;

    tmp.set(proc?.color ?? '#14303a');
    tmp.lerp(COLORS.hot, hot * 0.85);
    if (coreMat.current) {
      coreMat.current.emissive.copy(tmp);
      coreMat.current.emissiveIntensity = running ? 1.8 + pulse * 0.6 + hot * 1.8 : 0.08 + hot;
    }
    if (ihsMat.current) {
      ihsMat.current.emissive.copy(COLORS.hot);
      ihsMat.current.emissiveIntensity = hot * (0.25 + pulse * 0.35);
    }
    if (haloMat.current) haloMat.current.opacity = hot * (0.6 + pulse * 0.4);

    progressMat.uniforms.uFrac.value = running ? (frame?.remainingFrac ?? 0) : 0;
    progressMat.uniforms.uColor.value.copy(tmp);
    quantumMat.uniforms.uFrac.value = running && settings.algorithm === 'rr' ? 1 - (frame?.quantumFrac ?? 0) : 0;

    const sw = plan ? sinceLast(plan.contextSwitches, rt.sec).dt : Infinity;
    if (flashMat.current) flashMat.current.opacity = sw < 0.6 ? Math.exp(-sw * 9) * 0.9 : 0;
    const ds = plan ? sinceLast(plan.dispatches, rt.sec).dt : Infinity;
    if (schedFlashMat.current) schedFlashMat.current.opacity = ds < 0.8 ? Math.exp(-ds * 6) * 0.8 : 0;
  });

  const onPackageClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setLevel('L1', { manual: true });
  };
  const onCoreClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setLevel('L2', { manual: true });
  };
  const pointer = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setCursor(true);
    },
    onPointerOut: () => setCursor(false),
  };

  const plateZ = (ILM.height - 4) * 0.5;
  return (
    <group>
      <group onClick={onPackageClick} {...pointer}>
        {/* Socket housing and the ILM back frame. */}
        <mesh position={[c[0], H.socketBase / 2, c[2]]} castShadow receiveShadow>
          <boxGeometry args={[mm(SOCKET_SIZE), H.socketBase, mm(SOCKET_SIZE)]} />
          <meshStandardMaterial color="#141517" roughness={0.55} />
        </mesh>
        <mesh position={[c[0], H.ilm / 2, c[2]]} receiveShadow>
          <boxGeometry args={[ilm.w, H.ilm, ilm.d]} />
          <meshStandardMaterial {...STEEL} roughnessMap={tex.brushed} />
        </mesh>

        {/* Package substrate, die, and the system-agent end of the die that flashes on dispatch. */}
        <mesh position={[c[0], H.socketBase + H.substrate / 2, c[2]]} castShadow receiveShadow>
          <boxGeometry args={[mm(PACKAGE_SIZE), H.substrate, mm(PACKAGE_SIZE)]} />
          <meshPhysicalMaterial map={tex.sub} roughness={0.5} clearcoat={0.4} clearcoatRoughness={0.4} />
        </mesh>
        <mesh position={[c[0], CPU_STACK.substrateTop + H.die / 2, c[2]]} castShadow receiveShadow>
          <boxGeometry args={[die.w, H.die, die.d]} />
          <meshPhysicalMaterial
            map={tex.die}
            metalness={0.55}
            roughness={0.22}
            iridescence={0.85}
            iridescenceIOR={1.7}
            iridescenceThicknessMinimum={180}
            iridescenceThicknessMaximum={720}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </mesh>
        <mesh position={schedC} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[sched.w, sched.d]} />
          <meshBasicMaterial ref={schedFlashMat} color={[0.6, 2.4, 3]} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>

      {/* The scheduled core: glows in the running process colour, turns red under overload. */}
      <group onClick={onCoreClick} {...pointer}>
        <mesh position={[coreC[0], CPU_STACK.dieTop + mm(0.06), coreC[2]]}>
          <boxGeometry args={[core.w, mm(0.12), core.d]} />
          <meshPhysicalMaterial ref={coreMat} color="#06090b" metalness={0.5} roughness={0.3} clearcoat={1} clearcoatRoughness={0.1} emissive="#14303a" emissiveMap={tex.core} emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[coreC[0], CPU_STACK.dieTop + mm(0.14), coreC[2]]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[core.w, core.d]} />
          <meshBasicMaterial ref={flashMat} color={[4, 4, 4]} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[coreC[0], CPU_STACK.dieTop + mm(0.16), coreC[2]]} rotation-x={-Math.PI / 2} material={progressMat}>
          <ringGeometry args={[mm(CORE_PROGRESS_RADIUS), mm(CORE_PROGRESS_RADIUS + RING_STROKE), 96]} />
        </mesh>
        <mesh position={[coreC[0], CPU_STACK.dieTop + mm(0.16), coreC[2]]} rotation-x={-Math.PI / 2} material={quantumMat}>
          <ringGeometry args={[mm(QUANTUM_RING_RADIUS), mm(QUANTUM_RING_RADIUS + RING_STROKE), 96]} />
        </mesh>
      </group>

      {/* Load plate: hinged at the top edge, swings open at the CPU level. */}
      <group ref={plate} position={[c[0], H.socketBase + H.ihs * 0.2, hingeZ + mm(2)]} onClick={onPackageClick} {...pointer}>
        {[
          [0, mm(4), ilm.w * 0.92, mm(8)],
          [0, mm(ILM.height - 8), ilm.w * 0.92, mm(10)],
          [-ilm.w * 0.39, mm(plateZ), ilm.w * 0.14, mm(ILM.height - 8)],
          [ilm.w * 0.39, mm(plateZ), ilm.w * 0.14, mm(ILM.height - 8)],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0, z]} castShadow receiveShadow>
            <boxGeometry args={[w, mm(1.1), d]} />
            <meshStandardMaterial {...STEEL} roughnessMap={tex.brushed} />
          </mesh>
        ))}
      </group>

      {/* Retention lever along the right side, pivoting at the bottom end. */}
      <group ref={lever} position={[c[0] + ilm.w / 2 + mm(2), mm(2.2), toZ(ILM.y + ILM.height)]}>
        <mesh position={[0, 0, -mm(ILM.height * 0.48)]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[mm(1), mm(1), mm(ILM.height * 0.96), 12]} />
          <meshStandardMaterial {...STEEL} roughness={0.22} />
        </mesh>
        <mesh position={[mm(1.5), 0, -mm(ILM.height * 0.96)]} castShadow>
          <boxGeometry args={[mm(4), mm(1.6), mm(2.4)]} />
          <meshStandardMaterial {...STEEL} roughness={0.22} />
        </mesh>
      </group>

      {/* Heat spreader: lifts away once the plate is open. */}
      <group ref={ihs} onClick={(e) => (rt.ihsLift > 0.5 ? undefined : onPackageClick(e))}>
        <group position={[c[0], 0, c[2]]}>
          <RoundedBox args={[mm(IHS_SIZE), mm(1.4), mm(IHS_SIZE)]} radius={mm(0.6)} smoothness={3} position={[0, CPU_STACK.ihsTop - mm(0.7), 0]} castShadow receiveShadow>
            <meshPhysicalMaterial ref={ihsMat} color="#d4d7db" map={tex.ihs} metalness={1} roughness={0.55} roughnessMap={tex.brushed} envMapIntensity={1.1} />
          </RoundedBox>
          <mesh position={[0, CPU_STACK.substrateTop + (CPU_STACK.ihsTop - mm(1.4) - CPU_STACK.substrateTop) / 2, 0]}>
            <boxGeometry args={[mm(IHS_SIZE + 2), CPU_STACK.ihsTop - mm(1.4) - CPU_STACK.substrateTop, mm(IHS_SIZE - 6)]} />
            <meshStandardMaterial color="#b8bcc2" metalness={1} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Overload: red heat bleeding onto the board (a glow decal; a real light would cost every pixel). */}
      <mesh position={[c[0], mm(0.4), c[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[mm(190), mm(190)]} />
        <meshBasicMaterial ref={haloMat} map={radialGlowTexture()} color={[3, 0.35, 0.15]} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
