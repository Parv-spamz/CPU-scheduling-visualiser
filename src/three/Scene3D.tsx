import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Lightformer, PerformanceMonitor, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, Noise, SMAA, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useApp } from '../store/useApp';
import PlayerDriver from '../player/PlayerDriver';
import CameraRig from './CameraRig';
import Pcb from './Pcb';
import Socket from './Socket';
import RamBank from './RamBank';
import StorageBay from './StorageBay';
import PowerBlock from './PowerBlock';
import OutputPort from './OutputPort';
import FlowTraces from './FlowTraces';
import Chips from './Chips';
import Analyzer from './Analyzer';
import Readouts from './Readouts';
import AlgoButtons from './AlgoButtons';
import ResultsDeck from './ResultsDeck';

function Lights() {
  return (
    <>
      <color attach="background" args={['#040807']} />
      <fog attach="fog" args={['#040807', 30, 60]} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.4} position={[0, 9, 1]} rotation-x={Math.PI / 2} scale={[16, 9, 1]} color="#f4f8ff" />
        <Lightformer intensity={1.1} position={[-12, 4, 2]} rotation-y={Math.PI / 2} scale={[14, 3, 1]} color="#bfe8ff" />
        <Lightformer intensity={0.9} position={[12, 4, -2]} rotation-y={-Math.PI / 2} scale={[14, 3, 1]} color="#ffd9b8" />
        <Lightformer intensity={0.6} position={[0, 3, -12]} scale={[18, 4, 1]} color="#7af0ff" />
        {/* Large softbox behind and above: what flat metal and the glossy mask reflect toward the camera. */}
        <Lightformer intensity={1.8} position={[0, 7, -11]} rotation-x={Math.PI / 5} scale={[26, 8, 1]} color="#eef4ff" />
      </Environment>
      <ambientLight intensity={0.06} />
      <directionalLight
        castShadow
        position={[-7, 13, 8]}
        intensity={2.3}
        color="#fff6ea"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[9, 6, -6]} intensity={0.35} color="#9fdcff" />
    </>
  );
}

function Desk() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[90, 90]} />
      <meshStandardMaterial color="#0a0f0e" roughness={0.92} metalness={0} />
    </mesh>
  );
}

function Effects({ ao, lens }: { ao: boolean; lens: boolean }) {
  const common = [
    <Bloom key="bloom" mipmapBlur intensity={0.75} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.7} />,
    <SMAA key="smaa" />,
    <Vignette key="vig" offset={0.24} darkness={0.68} />,
    <ToneMapping key="tm" mode={ToneMappingMode.AGX} />,
    <Noise key="grain" opacity={0.035} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />,
  ];
  // Macro-lens look: soft focus falloff toward the top and bottom of the frame.
  const tilt = lens ? [<TiltShift2 key="tilt" blur={0.14} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} samples={8} />] : [];
  return (
    <EffectComposer multisampling={0}>
      {[...(ao ? [<N8AO key="ao" halfRes aoRadius={0.4} intensity={2.4} distanceFalloff={0.5} quality="medium" />] : []), ...tilt, ...common]}
    </EffectComposer>
  );
}

/** The single full-screen 3D motherboard scene. */
export default function Scene3D() {
  const [ao, setAo] = useState(true);
  const reducedMotion = useApp((s) => s.reducedMotion);
  return (
    <div className="scene" role="group" aria-label="3D motherboard scheduling scene">
      <Canvas
        shadows
        flat
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 32, near: 0.1, far: 120, position: [0, 13, 12] }}
        onPointerMissed={() => useApp.getState().selectPid(null)}
      >
        <PerformanceMonitor onDecline={() => setAo(false)} flipflops={2} />
        <AdaptiveDpr pixelated={false} />
        <Lights />
        <Suspense fallback={null}>
          <Desk />
          <Pcb />
          <FlowTraces />
          <PowerBlock />
          <StorageBay />
          <RamBank />
          <Socket />
          <OutputPort />
          <Analyzer />
          <Readouts />
          <AlgoButtons />
          <Chips />
          <ResultsDeck />
          <Preload all />
        </Suspense>
        <PlayerDriver />
        <CameraRig />
        <Effects ao={ao} lens={ao && !reducedMotion} />
      </Canvas>
    </div>
  );
}
