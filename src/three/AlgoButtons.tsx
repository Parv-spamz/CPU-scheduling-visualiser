import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ALGORITHMS, type AlgorithmId } from '../engine/types';
import { ALGO_BUTTON, ALGO_RING } from '../scene/layout';
import { algorithmExplanation, ringLabel } from '../scene/resultsModel';
import { useApp } from '../store/useApp';
import { FONT_SIZE, H, U, at } from './space';
import { FONTS } from './fonts';
import { damp } from './materials';

function Button({ id, index }: { id: AlgorithmId; index: number }) {
  const settings = useApp((s) => s.settings);
  const selected = settings.algorithm === id;
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  const setTooltip = useApp((s) => s.setTooltip);
  const cap = useRef<THREE.Group>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const pressed = useRef(false);
  const hovered = useRef(false);
  const p = at(ALGO_RING[index]);
  const w = ALGO_BUTTON.width * U;
  const d = ALGO_BUTTON.height * U;

  useFrame((_, dt) => {
    const y = H.button - (pressed.current ? 0.03 : 0) + (hovered.current && !pressed.current ? 0.008 : 0);
    if (cap.current) cap.current.position.y = damp(cap.current.position.y, y, 28, dt);
    if (led.current) led.current.opacity = damp(led.current.opacity, selected ? 1 : hovered.current ? 0.45 : 0.12, 10, dt);
  });

  const release = () => {
    pressed.current = false;
  };

  return (
    <group
      position={p}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        setAlgorithm(id);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        pressed.current = true;
      }}
      onPointerUp={release}
      onPointerOver={(e) => {
        e.stopPropagation();
        hovered.current = true;
        document.body.style.cursor = 'pointer';
        setTooltip(algorithmExplanation(id, settings));
      }}
      onPointerOut={() => {
        hovered.current = false;
        release();
        document.body.style.cursor = '';
        setTooltip('');
      }}
    >
      <RoundedBox args={[w, 0.04, d]} radius={0.012} position={[0, 0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#a9aeb4" metalness={1} roughness={0.32} />
      </RoundedBox>
      <group ref={cap} position={[0, H.button, 0]}>
        <RoundedBox args={[w - 0.06, 0.05, d - 0.06]} radius={0.018} smoothness={3} position={[0, -0.025, 0]} castShadow>
          <meshPhysicalMaterial color={selected ? '#0c2a30' : '#16191c'} roughness={0.32} clearcoat={0.8} />
        </RoundedBox>
        <mesh position={[0, 0.0015, d / 2 - 0.06]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w - 0.14, 0.014]} />
          <meshBasicMaterial ref={led} color={[0.6, 2.8, 3.2]} transparent opacity={0.12} toneMapped={false} />
        </mesh>
        <Text font={FONTS.monoBold} fontSize={FONT_SIZE.small * 0.95} position={[0, 0.002, -0.015]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle" letterSpacing={0.05}>
          {ringLabel(id, settings)}
          <meshBasicMaterial color={selected ? [0.7, 2.6, 3] : [0.9, 0.95, 1]} toneMapped={false} />
        </Text>
      </group>
    </group>
  );
}

/** Four tactile algorithm switches above the socket (brief §7.3 "ring of four selectors"). */
export default function AlgoButtons() {
  return (
    <group>
      {ALGORITHMS.map((id, i) => (
        <Button key={id} id={id} index={i} />
      ))}
    </group>
  );
}
