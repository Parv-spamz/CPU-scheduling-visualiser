import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../store/useApp';
import {
  CACHE_BLOCKS,
  CORE,
  CORE_PROGRESS_RADIUS,
  CPU_CENTER,
  DIE,
  DIE_SIZE,
  QUANTUM_RING_RADIUS,
  RING_STROKE,
  SCHEDULER,
  SOCKET,
  SOCKET_SIZE,
} from '../scene/layout';
import { ringLabel } from '../scene/resultsModel';
import { rt } from '../player/runtime';
import { coreFrameAt, sinceLast } from '../player/sceneState';
import { CPU_STACK, FONT_SIZE, H, U, at, rectCenter, rectSize } from './space';
import { FONTS } from './fonts';
import { COLORS, arcRingMaterial, damp, radialGlowTexture } from './materials';
import { brushedTexture, coreTexture, dieTexture, ihsTexture, substrateTexture } from './textures';

const SUBSTRATE = ((SOCKET_SIZE + DIE_SIZE) / 2) * U;
const IHS_SIZE = (DIE_SIZE + 20) * U;
const FRAME_OUTER = (SOCKET_SIZE + 24) * U;
const FRAME_INNER = (SOCKET_SIZE - 34) * U;
const FRAME_T = (FRAME_OUTER - FRAME_INNER) / 2;
const IHS_PLATE = 0.04;
/** How far back the lifted heat spreader slides (world units). */
const IHS_SLIDE = SOCKET_SIZE * U * 1.2;
const tmp = new THREE.Color();

function setCursor(on: boolean) {
  document.body.style.cursor = on ? 'pointer' : '';
}

export default function Socket() {
  const settings = useApp((s) => s.run?.settings ?? s.settings);
  const note = useApp((s) => s.playhead.note);
  const setLevel = useApp((s) => s.setLevel);
  const setTooltip = useApp((s) => s.setTooltip);

  const ihs = useRef<THREE.Group>(null);
  const ihsMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const ihsSkirtMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const schedFlashMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const heatLight = useRef<THREE.PointLight>(null);
  const idleText = useRef<THREE.Mesh & { fillOpacity: number }>(null);

  const progressMat = useMemo(() => arcRingMaterial('#ffffff'), []);
  const quantumMat = useMemo(() => arcRingMaterial('#ffc94d'), []);
  const tex = useMemo(
    () => ({ die: dieTexture(), ihs: ihsTexture(), sub: substrateTexture(), brushed: brushedTexture(), core: coreTexture() }),
    [],
  );

  const c = at(CPU_CENTER);
  const die = rectSize(DIE);
  const core = rectSize(CORE);
  const sched = rectSize(SCHEDULER);
  const schedC = rectCenter(SCHEDULER, CPU_STACK.dieTop + 0.004);

  useFrame((state, dt) => {
    const s = useApp.getState();
    const lift = damp(rt.ihsLift, s.level === 'L1' || s.level === 'L2' ? 1 : 0, s.reducedMotion ? 12 : 3.2, dt);
    rt.ihsLift = lift;
    const heat = rt.load;
    const hot = THREE.MathUtils.smoothstep(heat, 0.45, 1);
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * (3 + hot * 5));

    if (ihs.current && ihsMat.current && ihsSkirtMat.current) {
      // Lift up and slide away behind the socket so it never blocks the close-up views.
      ihs.current.position.set(0, lift * H.ihsLift, -lift * IHS_SLIDE);
      ihs.current.rotation.x = -lift * 0.5;
      const fade = 1 - THREE.MathUtils.smoothstep(lift, 0.25, 0.9);
      ihs.current.visible = fade > 0.02;
      ihsMat.current.opacity = fade;
      ihsSkirtMat.current.opacity = fade;
      const opaque = fade > 0.99;
      ihsMat.current.transparent = ihsSkirtMat.current.transparent = !opaque;
      ihsMat.current.depthWrite = ihsSkirtMat.current.depthWrite = opaque;
    }

    const run = rt.run;
    const plan = rt.plan;
    const frame = run ? coreFrameAt(run, rt.t, settings.quantum) : null;
    const pid = frame?.segment?.pid ?? null;
    const proc = pid !== null ? run?.processes.find((p) => p.pid === pid) : undefined;
    const running = !!proc;

    tmp.set(proc?.color ?? '#1a3d4a');
    tmp.lerp(COLORS.hot, hot * 0.85);
    if (coreMat.current) {
      coreMat.current.emissive.copy(tmp);
      coreMat.current.emissiveIntensity = running ? 1.6 + pulse * 0.6 + hot * 1.8 : 0.12 + hot;
    }
    if (coreLight.current) {
      // The core light only matters once the die is exposed; under the lid it would make a hotspot.
      coreLight.current.color.copy(tmp);
      coreLight.current.intensity = (running ? 1.2 + pulse * 0.5 + hot * 2.5 : 0) * lift;
    }
    if (ihsMat.current) {
      // Seated lid: a faint tint of the running process, and red heat under overload.
      ihsMat.current.emissive.copy(tmp);
      ihsMat.current.emissiveIntensity = (running ? 0.05 : 0) + hot * (0.3 + pulse * 0.4);
    }
    if (heatLight.current) heatLight.current.intensity = THREE.MathUtils.smoothstep(hot, 0.15, 1) * (8 + pulse * 8);
    if (haloMat.current) haloMat.current.opacity = hot * (0.45 + pulse * 0.4);

    progressMat.uniforms.uFrac.value = running ? (frame?.remainingFrac ?? 0) : 0;
    progressMat.uniforms.uColor.value.copy(tmp);
    quantumMat.uniforms.uFrac.value = running && settings.algorithm === 'rr' ? 1 - (frame?.quantumFrac ?? 0) : 0;

    const sw = plan ? sinceLast(plan.contextSwitches, rt.sec).dt : Infinity;
    if (flashMat.current) flashMat.current.opacity = sw < 0.6 ? Math.exp(-sw * 9) * 0.9 : 0;
    const ds = plan ? sinceLast(plan.dispatches, rt.sec).dt : Infinity;
    if (schedFlashMat.current) schedFlashMat.current.opacity = ds < 0.8 ? Math.exp(-ds * 6) * 0.85 : 0;

    const idle = !!run && !!frame?.segment && pid === null;
    if (idleText.current) idleText.current.fillOpacity = damp(idleText.current.fillOpacity, idle ? 1 : 0, 8, dt);
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
  const hover = (text: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setCursor(true);
      setTooltip(text);
    },
    onPointerOut: () => {
      setCursor(false);
      setTooltip('');
    },
  });

  return (
    <group>
      {/* Socket body, load plate and lever: click to zoom into the CPU. */}
      <group onClick={onPackageClick} {...hover('CPU package: the scheduler and core live on this die. Click to zoom in.')}>
        <RoundedBox args={[SOCKET_SIZE * U, H.socketBase, SOCKET_SIZE * U]} radius={0.02} position={[c[0], H.socketBase / 2, c[2]]} castShadow receiveShadow>
          <meshStandardMaterial color="#121416" roughness={0.55} />
        </RoundedBox>
        {[
          [0, -(FRAME_INNER + FRAME_T) / 2, FRAME_OUTER, FRAME_T],
          [0, (FRAME_INNER + FRAME_T) / 2, FRAME_OUTER, FRAME_T],
          [-(FRAME_INNER + FRAME_T) / 2, 0, FRAME_T, FRAME_INNER],
          [(FRAME_INNER + FRAME_T) / 2, 0, FRAME_T, FRAME_INNER],
        ].map(([dx, dz, w, d], i) => (
          <mesh key={i} position={[c[0] + dx, H.socketBase + 0.012, c[2] + dz]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.024, d]} />
            <meshStandardMaterial color="#b9bcc0" metalness={1} roughness={0.38} roughnessMap={tex.brushed} />
          </mesh>
        ))}
        <mesh position={[c[0] + FRAME_OUTER / 2 + 0.09, H.socketBase * 0.6, c[2]]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.022, 0.022, FRAME_OUTER * 1.05, 16]} />
          <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[c[0] + FRAME_OUTER / 2 + 0.09, H.socketBase * 0.6, c[2] + FRAME_OUTER * 0.55]} castShadow>
          <boxGeometry args={[0.1, 0.03, 0.14]} />
          <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.25} />
        </mesh>

        {/* Package substrate and die. */}
        <mesh position={[c[0], H.socketBase + H.substrate / 2, c[2]]} castShadow receiveShadow>
          <boxGeometry args={[SUBSTRATE, H.substrate, SUBSTRATE]} />
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
        {CACHE_BLOCKS.map((b, i) => {
          const sz = rectSize(b);
          return (
            <mesh key={i} position={rectCenter(b, CPU_STACK.dieTop + 0.006)} castShadow>
              <boxGeometry args={[sz.w, 0.012, sz.d]} />
              <meshPhysicalMaterial color="#7d6440" map={tex.die} metalness={0.85} roughness={0.32} iridescence={0.5} />
            </mesh>
          );
        })}

        {/* Scheduler logic block with its one-line decision readout. */}
        <mesh position={schedC} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[sched.w, sched.d]} />
          <meshPhysicalMaterial color="#05090c" roughness={0.15} clearcoat={1} emissive="#0e3540" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[schedC[0], schedC[1] + 0.001, schedC[2]]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[sched.w, sched.d]} />
          <meshBasicMaterial ref={schedFlashMat} color={[0.6, 2.4, 3]} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
        <Text
          font={FONTS.monoBold}
          fontSize={FONT_SIZE.small}
          position={[schedC[0] - sched.w / 2 + 0.06, schedC[1] + 0.003, schedC[2] - 0.07]}
          rotation-x={-Math.PI / 2}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.06}
        >
          {`SCHED · ${ringLabel(settings.algorithm, settings)}`}
          <meshBasicMaterial color={[0.5, 2.2, 2.6]} toneMapped={false} />
        </Text>
        <Text
          font={FONTS.mono}
          fontSize={FONT_SIZE.small * 0.85}
          maxWidth={sched.w - 0.1}
          position={[schedC[0] - sched.w / 2 + 0.06, schedC[1] + 0.003, schedC[2] + 0.075]}
          rotation-x={-Math.PI / 2}
          anchorX="left"
          anchorY="middle"
        >
          {note || 'waiting for dispatch'}
          <meshBasicMaterial color={[1.6, 1.5, 1.1]} toneMapped={false} />
        </Text>
      </group>

      {/* The core: glows in the running process colour, turns red under overload. Click for L2. */}
      <group onClick={onCoreClick} {...hover('Core: one process runs here at a time. Click to zoom into the core.')}>
        <mesh position={[c[0], CPU_STACK.dieTop + 0.007, c[2]]} castShadow>
          <boxGeometry args={[core.w, 0.014, core.d]} />
          <meshPhysicalMaterial ref={coreMat} color="#070b0d" metalness={0.5} roughness={0.3} clearcoat={1} clearcoatRoughness={0.1} emissive="#1a3d4a" emissiveMap={tex.core} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[c[0], CPU_STACK.dieTop + 0.016, c[2]]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[core.w, core.d]} />
          <meshBasicMaterial ref={flashMat} color={[4, 4, 4]} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[c[0], CPU_STACK.dieTop + 0.02, c[2]]} rotation-x={-Math.PI / 2} material={progressMat}>
          <ringGeometry args={[CORE_PROGRESS_RADIUS * U, (CORE_PROGRESS_RADIUS + RING_STROKE) * U, 96]} />
        </mesh>
        <mesh position={[c[0], CPU_STACK.dieTop + 0.02, c[2]]} rotation-x={-Math.PI / 2} material={quantumMat}>
          <ringGeometry args={[QUANTUM_RING_RADIUS * U, (QUANTUM_RING_RADIUS + RING_STROKE) * U, 96]} />
        </mesh>
        <Text
          ref={idleText}
          font={FONTS.monoBold}
          fontSize={FONT_SIZE.label}
          position={[c[0], CPU_STACK.dieTop + 0.03, c[2]]}
          rotation-x={-Math.PI / 2}
          fillOpacity={0}
          letterSpacing={0.2}
        >
          IDLE
          <meshBasicMaterial color={[0.4, 0.9, 1.1]} toneMapped={false} transparent />
        </Text>
      </group>
      <pointLight ref={coreLight} position={[c[0], CPU_STACK.dieTop + 0.12, c[2]]} distance={2.4} decay={2} intensity={0} />

      {/* Heat spreader: lifts off when the camera dives into the package. */}
      <group
        ref={ihs}
        onClick={(e) => {
          if (rt.ihsLift > 0.5) return; // lifted: let the click reach the die below
          onPackageClick(e);
        }}
      >
        <group position={[c[0], 0, c[2]]}>
          <RoundedBox args={[IHS_SIZE, IHS_PLATE, IHS_SIZE]} radius={0.015} smoothness={3} position={[0, CPU_STACK.ihsTop - IHS_PLATE / 2, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial
              ref={ihsMat}
              color="#d4d7db"
              map={tex.ihs}
              metalness={1}
              roughness={0.62}
              roughnessMap={tex.brushed}
              envMapIntensity={1.1}
            />
          </RoundedBox>
          <mesh position={[0, CPU_STACK.substrateTop + (CPU_STACK.ihsTop - IHS_PLATE - CPU_STACK.substrateTop) / 2, 0]}>
            <boxGeometry args={[IHS_SIZE * 1.06, CPU_STACK.ihsTop - IHS_PLATE - CPU_STACK.substrateTop, IHS_SIZE * 1.06]} />
            <meshStandardMaterial ref={ihsSkirtMat} color="#b8bcc2" metalness={1} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Overload: red heat bleeding onto the board and a red light over the socket. */}
      <mesh position={[c[0], 0.01, c[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[SOCKET.width * U * 2.2, SOCKET.height * U * 2.2]} />
        <meshBasicMaterial
          ref={haloMat}
          map={radialGlowTexture()}
          color={[3, 0.35, 0.15]}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={heatLight} position={[c[0], 2.4, c[2] + 0.8]} color="#ff3b1f" distance={9} decay={1.5} intensity={0} />
    </group>
  );
}
