import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { POWER_BLOCK } from '../scene/layout';
import { rectCenter, rectSize } from './space';
import { brushedTexture } from './textures';

const FINS = 14;

/** VRM decoration: a finned heatsink over chokes, plus a row of solid capacitors. */
export default function PowerBlock() {
  const c = rectCenter(POWER_BLOCK);
  const s = rectSize(POWER_BLOCK);
  const brushed = useMemo(() => brushedTexture(), []);
  const sinkD = s.d * 0.55;
  const finPitch = s.w / FINS;

  return (
    <group position={[c[0], 0, c[2]]}>
      {/* Heatsink base and fins */}
      <RoundedBox args={[s.w, 0.08, sinkD]} radius={0.015} position={[0, 0.04, -s.d / 2 + sinkD / 2]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b3036" metalness={0.9} roughness={0.42} roughnessMap={brushed} />
      </RoundedBox>
      {Array.from({ length: FINS }, (_, i) => (
        <mesh key={i} position={[-s.w / 2 + finPitch * (i + 0.5), 0.2, -s.d / 2 + sinkD / 2]} castShadow receiveShadow>
          <boxGeometry args={[finPitch * 0.38, 0.24, sinkD]} />
          <meshStandardMaterial color="#353b42" metalness={0.9} roughness={0.38} roughnessMap={brushed} />
        </mesh>
      ))}
      {/* Chokes peeking out below the heatsink */}
      {Array.from({ length: 5 }, (_, i) => (
        <RoundedBox
          key={i}
          args={[0.24, 0.12, 0.2]}
          radius={0.02}
          position={[-s.w / 2 + 0.2 + i * ((s.w - 0.4) / 4), 0.06, -s.d / 2 + sinkD + 0.14]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#4a4d52" metalness={0.6} roughness={0.55} />
        </RoundedBox>
      ))}
      {/* Solid capacitors */}
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[-s.w / 2 + 0.17 + i * ((s.w - 0.34) / 5), 0, s.d / 2 - 0.1]}>
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.2, 28]} />
            <meshPhysicalMaterial color="#1c1830" metalness={0.7} roughness={0.28} clearcoat={0.6} />
          </mesh>
          <mesh position={[0, 0.2015, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.068, 28]} />
            <meshStandardMaterial color="#c7c9cc" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
