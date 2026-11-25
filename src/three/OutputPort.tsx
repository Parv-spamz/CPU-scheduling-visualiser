import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { OUTPUT_PORT } from '../scene/layout';
import { rt } from '../player/runtime';
import { useApp } from '../store/useApp';
import { rectCenter, rectSize } from './space';
import { brushedTexture } from './textures';
import { damp } from './materials';

/** Retire port: finished processes leave the board through here. Its LED blinks on completion. */
export default function OutputPort() {
  const c = rectCenter(OUTPUT_PORT);
  const s = rectSize(OUTPUT_PORT);
  const brushed = useMemo(() => brushedTexture(), []);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const setTooltip = useApp((st) => st.setTooltip);

  useFrame((_, dt) => {
    const plan = rt.plan;
    let active = false;
    if (plan) {
      for (const moves of plan.moves.values()) {
        for (const m of moves) if (m.kind === 'exit' && rt.sec >= m.start && rt.sec <= m.start + m.duration + 0.25) active = true;
      }
    }
    if (led.current) led.current.opacity = damp(led.current.opacity, active ? 1 : 0.12, 12, dt);
  });

  return (
    <group
      position={[c[0], 0, c[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setTooltip('Retire port: completed processes leave the board here.');
      }}
      onPointerOut={() => setTooltip('')}
    >
      <RoundedBox args={[s.w, 0.22, s.d]} radius={0.02} position={[0, 0.11, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#aeb3b8" metalness={1} roughness={0.3} roughnessMap={brushed} />
      </RoundedBox>
      <mesh position={[0, 0.11, -s.d / 2 - 0.001]}>
        <planeGeometry args={[s.w * 0.8, 0.12]} />
        <meshStandardMaterial color="#030405" roughness={0.9} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-s.w * 0.35 + i * ((s.w * 0.7) / 7), 0.11, -s.d / 2 + 0.01]}>
          <boxGeometry args={[0.03, 0.02, 0.02]} />
          <meshStandardMaterial color="#d6ad55" metalness={1} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[s.w / 2 + 0.1, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.04, 20]} />
        <meshBasicMaterial ref={led} color={[0.5, 3.5, 1]} transparent opacity={0.12} toneMapped={false} />
      </mesh>
    </group>
  );
}
