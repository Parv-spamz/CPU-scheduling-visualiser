import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { M2 } from '../../scene/layout';
import { H, mm, toX, toZ } from '../kit/space';
import { brushedTexture } from '../kit/canvasTexture';

/**
 * M.2 2280 NVMe drive in its socket between the first two x16 slots. Processes that have not
 * arrived yet wait on it as packets of light.
 */
export default function M2Drive() {
  const brushed = useMemo(() => brushedTexture(), []);
  const y0 = toZ(M2.y + M2.height / 2);
  const x = (v: number) => toX(M2.x + v);
  const top = H.m2;
  return (
    <group>
      {/* Socket (key M) at the rear end and the screw standoff at the far end. */}
      <mesh position={[x(3), mm(2.2), y0]} castShadow receiveShadow>
        <boxGeometry args={[mm(6), mm(4.4), mm(22)]} />
        <meshStandardMaterial color="#131415" roughness={0.55} />
      </mesh>
      <mesh position={[x(80), mm(1.4), y0]} castShadow>
        <cylinderGeometry args={[mm(2.6), mm(2.6), mm(2.8), 6]} />
        <meshStandardMaterial color="#c8ccd1" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[x(80), top + mm(0.5), y0]} castShadow>
        <cylinderGeometry args={[mm(2.4), mm(2.4), mm(1), 24]} />
        <meshStandardMaterial color="#d7dade" metalness={1} roughness={0.25} roughnessMap={brushed} />
      </mesh>
      {/* Module PCB with gold edge fingers, controller, DRAM cache and two NAND packages. */}
      <mesh position={[x(41), top - mm(0.4), y0]} castShadow receiveShadow>
        <boxGeometry args={[mm(80), mm(0.8), mm(22)]} />
        <meshStandardMaterial color="#0e1012" roughness={0.5} />
      </mesh>
      <mesh position={[x(2.6), top - mm(0.1), y0]}>
        <boxGeometry args={[mm(3.4), mm(0.3), mm(20)]} />
        <meshStandardMaterial color="#d4b15e" metalness={1} roughness={0.25} />
      </mesh>
      <RoundedBox args={[mm(8.5), mm(1.2), mm(8.5)]} radius={mm(0.4)} smoothness={2} position={[x(15), top + mm(0.6), y0]} castShadow>
        <meshStandardMaterial color="#1a1b1d" roughness={0.35} metalness={0.2} />
      </RoundedBox>
      <mesh position={[x(15), top + mm(1.22), y0]}>
        <boxGeometry args={[mm(5), mm(0.05), mm(5)]} />
        <meshStandardMaterial color="#b9bdc2" metalness={1} roughness={0.2} />
      </mesh>
      <RoundedBox args={[mm(6), mm(1), mm(9)]} radius={mm(0.3)} smoothness={2} position={[x(26), top + mm(0.5), y0]} castShadow>
        <meshStandardMaterial color="#151618" roughness={0.4} />
      </RoundedBox>
      {[44, 64].map((cx) => (
        <RoundedBox key={cx} args={[mm(16), mm(1.3), mm(14)]} radius={mm(0.4)} smoothness={2} position={[x(cx), top + mm(0.65), y0]} castShadow>
          <meshStandardMaterial color="#141517" roughness={0.38} />
        </RoundedBox>
      ))}
    </group>
  );
}
