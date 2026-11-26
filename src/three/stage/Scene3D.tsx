import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { rt } from '../../player/runtime';
import Boot from './Boot';
import { Environment, Lightformer, Preload } from '@react-three/drei';
import { BrightnessContrast, Bloom, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useApp } from '../../store/useApp';
import PlayerDriver from '../../player/PlayerDriver';
import CameraRig, { FOV } from '../camera/CameraRig';
import Pcb from '../board/Pcb';
import PowerDelivery from '../board/PowerDelivery';
import Components from '../board/Components';
import Socket from '../cpu/Socket';
import MemoryBank from '../peripherals/MemoryBank';
import M2Drive from '../peripherals/M2Drive';
import RearIO from '../peripherals/RearIO';
import FlowTraces from '../peripherals/FlowTraces';
import Indicators from '../instruments/Indicators';
import Packets from '../chips/Packets';
import ResultsDeck from '../results/ResultsDeck';
import Room from '../room/Room';

function Lights() {
  return (
    <>
      <color attach="background" args={['#0b1119']} />
      <fog attach="fog" args={['#0b1119', 48, 130]} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.4} position={[0, 9, 1]} rotation-x={Math.PI / 2} scale={[16, 9, 1]} color="#f4f8ff" />
        <Lightformer intensity={1.1} position={[-12, 4, 2]} rotation-y={Math.PI / 2} scale={[14, 3, 1]} color="#bfe8ff" />
        <Lightformer intensity={0.9} position={[12, 4, -2]} rotation-y={-Math.PI / 2} scale={[14, 3, 1]} color="#ffd9b8" />
        <Lightformer intensity={0.6} position={[0, 3, -12]} scale={[18, 4, 1]} color="#7af0ff" />
        {/* Large softbox behind and above: what flat metal and the glossy mask reflect toward the camera. */}
        <Lightformer intensity={1.8} position={[0, 7, -11]} rotation-x={Math.PI / 5} scale={[26, 8, 1]} color="#eef4ff" />
      </Environment>
      <ambientLight intensity={0.16} color="#8fa6d8" />
      <directionalLight
        castShadow
        position={[-7, 13, 8]}
        intensity={2.3}
        color="#fff6ea"
        shadow-mapSize={[4096, 4096]}
        shadow-radius={4}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <directionalLight position={[9, 6, -6]} intensity={0.35} color="#9fdcff" />
    </>
  );
}

/**
 * Board shadows are static except while the heat spreader lifts or the results deck rises,
 * so the shadow map is re-rendered only then (chips use contact shadows instead).
 */
function ShadowBaker() {
  const gl = useThree((s) => s.gl);
  const last = useRef({ ihs: -1, results: -1, frames: 0, dirty: false });
  useFrame(() => {
    gl.shadowMap.autoUpdate = false;
    const l = last.current;
    const moving = Math.abs(rt.ihsLift - l.ihs) > 1e-4 || Math.abs(rt.results - l.results) > 1e-4;
    // While something moves, the shadow map is redrawn every other frame (the shadows drift slowly, so the
    // lag is invisible) and once more when it stops, so a slow GPU never pays for the big map every frame.
    if (l.frames < 12) gl.shadowMap.needsUpdate = true;
    else if (moving) {
      if (l.frames % 2 === 0) gl.shadowMap.needsUpdate = true;
      l.dirty = true;
    } else if (l.dirty) {
      gl.shadowMap.needsUpdate = true;
      l.dirty = false;
    }
    l.ihs = rt.ihsLift;
    l.results = rt.results;
    l.frames++;
  });
  return null;
}

/**
 * Quality tiers, chosen by the frame-time monitor so a weak GPU still holds a high frame rate:
 * 0 bloom and SMAA at lower resolution, 1 + grading, 2 + ambient occlusion. The glow never switches off.
 * The tier is picked once from the measured frame time (see TierPicker), never flipped back and forth,
 * because rebuilding the effect chain mid-session is itself a visible hitch.
 * The vignette is a CSS overlay, so it costs the GPU nothing.
 */
function Effects({ tier }: { tier: number }) {
  const list = [
    tier >= 2 && !OFF.has('ao') ? <N8AO key="ao" halfRes aoRadius={0.35} intensity={2.2} distanceFalloff={0.5} quality="low" /> : null,
    !OFF.has('bloom') ? (
      <Bloom key="bloom" intensity={0.75} luminanceThreshold={0.85} luminanceSmoothing={0.25} radius={0.65} resolutionScale={tier >= 1 ? 0.4 : 0.3} levels={tier >= 1 ? 4 : 3} />
    ) : null,
    tier >= 1 && !OFF.has('grade') ? <HueSaturation key="hs" saturation={-0.04} /> : null,
    tier >= 1 && !OFF.has('grade') ? <BrightnessContrast key="bc" brightness={0.0} contrast={0.05} /> : null,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    MS === 0 && !OFF.has('smaa') ? <SMAA key="smaa" /> : null,
  ].filter((e): e is ReactElement => e !== null);
  return (
    <EffectComposer multisampling={MS} frameBufferType={LDR ? THREE.UnsignedByteType : THREE.HalfFloatType}>
      {list}
    </EffectComposer>
  );
}

/** Debug: `?no=ao,bloom` turns individual effects off. */
const OFF = new Set(typeof location === 'undefined' ? [] : (new URLSearchParams(location.search).get('no') ?? '').split(','));

/** Debug: `?ms=0|2|4` sets composer multisampling and `?ldr=1` uses an 8-bit buffer. */
const QS = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const MS = Number(QS.get('ms') ?? 0);
const LDR = QS.get('ldr') === '1';

/** `?fx=0` turns post-processing off (low-power machines, debugging). */
const FX = typeof location === 'undefined' || new URLSearchParams(location.search).get('fx') !== '0';

/** Plain renders tone-map in the renderer; with the composer the tone-map effect does it. */
function ToneMapSwitch({ composer }: { composer: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = composer ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl, composer]);
  return null;
}

/** Dev only: exposes the renderer so draw calls and triangles can be inspected from the console. */
function DevProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  if (import.meta.env.DEV || QS.get('debug') === '1') Object.assign(window, { __gl: gl, __scene: scene, __camera: camera });
  return null;
}

/**
 * Picks the quality tier once, after the scene is up and warm: the median frame time of 90 frames decides.
 * Hitches (tab switches, shader compiles) are ignored, and the pick is only ever lowered later if the
 * frame time stays far over budget for a long stretch, at most twice.
 */
function TierPicker({ ready, onTier }: { ready: boolean; onTier: (t: number) => void }) {
  const st = useRef({ warm: 0, ms: [] as number[], picked: false, tier: 1, drops: 0, window: [] as number[] });
  useFrame((_, dt) => {
    if (!ready || OFF.has('tier')) return;
    const s = st.current;
    const ms = dt * 1000;
    if (s.warm < 120) {
      s.warm++;
      return;
    }
    if (ms > 250) return;
    const buf = s.picked ? s.window : s.ms;
    buf.push(ms);
    const need = s.picked ? 240 : 90;
    if (buf.length < need) return;
    const sorted = [...buf].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    buf.length = 0;
    if (!s.picked) {
      s.picked = true;
      // Ambient occlusion only where there is a lot of headroom; plain bloom tier on a slow GPU.
      s.tier = median > 24 ? 0 : median < 5 ? 2 : 1;
      onTier(s.tier);
    } else if (median > 30 && s.tier > 0 && s.drops < 2) {
      s.drops++;
      s.tier -= 1;
      onTier(s.tier);
    }
  });
  return null;
}

/** Signals once the scene has rendered a couple of frames (textures and fonts are in). */
function Ready({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
    if (frames.current === 3) onReady();
  });
  return null;
}

/** The single full-screen 3D motherboard scene. */
export default function Scene3D() {
  const [tier, setTier] = useState(1);
  const [ready, setReady] = useState(false);
  if (QS.get('debug') === '1') Object.assign(window, { __tier: tier });
  return (
    <div className="scene" role="group" aria-label="3D motherboard scheduling scene. Drag to rotate, scroll to zoom, right-drag to pan, R to reset the view.">
      <Canvas
        shadows="percentage"
        flat
        dpr={tier === 0 ? [0.85, 1] : [1, 1.5]}
        gl={{ antialias: !FX, powerPreference: 'high-performance', stencil: false, depth: true }}
        camera={{ fov: FOV, near: 0.35, far: 160, position: [-6, 13, 13] }}
        onPointerMissed={() => useApp.getState().selectPid(null)}
      >
        <TierPicker ready={ready} onTier={setTier} />
        <ToneMapSwitch composer={FX} />
        <Lights />
        <ShadowBaker />
        <DevProbe />
        <Suspense fallback={null}>
          <Room />
          <Pcb />
          <FlowTraces />
          <PowerDelivery />
          <Components />
          <M2Drive />
          <MemoryBank />
          <Socket />
          <RearIO />
          <Indicators />
          <Packets />
          <ResultsDeck />
          <Preload all />
          <Ready onReady={() => setReady(true)} />
        </Suspense>
        <PlayerDriver />
        <CameraRig />
        {FX && <Effects tier={tier} />}
      </Canvas>
      <div className="vignette" aria-hidden="true" />
      <Boot ready={ready} />
    </div>
  );
}
