import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { STORAGE, STORAGE_GRID } from '../scene/layout';
import { useApp } from '../store/useApp';
import { H, U, rectCenter, rectSize } from './space';
import { brushedTexture } from './textures';

const WALL = 0.06;

/** NVMe job pool: an aluminium bay with a 4 x 3 parking grid for processes not yet arrived. */
export default function StorageBay() {
  const setTooltip = useApp((s) => s.setTooltip);
  const c = rectCenter(STORAGE);
  const s = rectSize(STORAGE);
  const brushed = useMemo(() => brushedTexture(), []);
  const cw = s.w / STORAGE_GRID.cols;
  const ch = s.d / STORAGE_GRID.rows;

  return (
    <group
      position={[c[0], 0, c[2]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setTooltip('Storage: processes that have not arrived yet wait here until their arrival tick.');
      }}
      onPointerOut={() => setTooltip('')}
    >
      <mesh position={[0, H.storageFloor / 2, 0]} receiveShadow>
        <boxGeometry args={[s.w, H.storageFloor, s.d]} />
        <meshStandardMaterial color="#0d1114" roughness={0.7} />
      </mesh>
      {/* Outer walls */}
      {[
        [0, -s.d / 2, s.w + WALL, WALL],
        [0, s.d / 2, s.w + WALL, WALL],
        [-s.w / 2, 0, WALL, s.d],
        [s.w / 2, 0, WALL, s.d],
      ].map(([x, z, w, d], i) => (
        <RoundedBox key={i} args={[w, H.storageWall, d]} radius={0.012} smoothness={2} position={[x, H.storageWall / 2, z]} castShadow receiveShadow>
          <meshStandardMaterial color="#8d949b" metalness={1} roughness={0.36} roughnessMap={brushed} />
        </RoundedBox>
      ))}
      {/* Grid dividers */}
      {Array.from({ length: STORAGE_GRID.cols - 1 }, (_, i) => (
        <mesh key={`c${i}`} position={[-s.w / 2 + cw * (i + 1), H.storageFloor + 0.02, 0]} castShadow>
          <boxGeometry args={[0.012, 0.04, s.d - WALL]} />
          <meshStandardMaterial color="#5d646b" metalness={0.9} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: STORAGE_GRID.rows - 1 }, (_, i) => (
        <mesh key={`r${i}`} position={[0, H.storageFloor + 0.02, -s.d / 2 + ch * (i + 1)]} castShadow>
          <boxGeometry args={[s.w - WALL, 0.04, 0.012]} />
          <meshStandardMaterial color="#5d646b" metalness={0.9} roughness={0.4} />
        </mesh>
      ))}
      {/* M.2 standoff screw */}
      <mesh position={[s.w / 2 - 0.12, H.storageWall + 0.01, -s.d / 2 + 0.12]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 24]} />
        <meshStandardMaterial color="#c0c4c8" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0, H.storageFloor + 0.001, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[s.w - WALL, (STORAGE.height - 20) * U]} />
        <meshStandardMaterial color="#0a0e10" roughness={0.85} />
      </mesh>
    </group>
  );
}
