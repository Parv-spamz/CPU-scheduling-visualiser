// Small primitives for building the bedroom: boxes, cylinders and spheres with the room's muted lighting.
import { RoundedBox } from '@react-three/drei';
import type * as THREE from 'three';
import type { Pbr } from './pbr';

export type V3 = [number, number, number];

/** Room materials reflect the studio environment less, so the room reads as a dim night-time space. */
export const ENV = 0.35;

interface BoxProps {
  p: V3;
  s: V3;
  c?: string;
  r?: number;
  m?: number;
  rot?: V3;
  cast?: boolean;
  round?: number;
  map?: THREE.Texture | null;
  glow?: V3;
  env?: number;
  pbr?: Pbr;
  /** Receives shadows from the shadow map (costs a few texture reads per pixel, so only where it shows). */
  recv?: boolean;
}

export function B({ p, s, c = '#888888', r = 0.8, m = 0, rot, cast, round, map, glow, env = ENV, pbr, recv }: BoxProps) {
  // Matte parts use the cheaper Lambert shader: the room covers most of the screen and fill cost matters.
  const mat = pbr ? (
    <meshStandardMaterial color={c} roughness={1} map={pbr.map} normalMap={pbr.normalMap} roughnessMap={pbr.roughnessMap ?? null} envMapIntensity={env} />
  ) : glow ? (
    <meshBasicMaterial color={glow} toneMapped={false} />
  ) : m > 0 || r < 0.45 ? (
    <meshStandardMaterial color={map ? '#ffffff' : c} roughness={r} metalness={m} map={map ?? undefined} envMapIntensity={env} />
  ) : (
    <meshLambertMaterial color={map ? '#ffffff' : c} map={map ?? undefined} />
  );
  if (round)
    return (
      <RoundedBox args={s} radius={Math.min(round, Math.min(...s) / 2 - 0.001)} smoothness={3} position={p} rotation={rot} castShadow={cast} receiveShadow={recv}>
        {mat}
      </RoundedBox>
    );
  return (
    <mesh position={p} rotation={rot} castShadow={cast} receiveShadow={recv}>
      <boxGeometry args={s} />
      {mat}
    </mesh>
  );
}

interface CylProps {
  p: V3;
  r: number;
  h: number;
  c?: string;
  rough?: number;
  metal?: number;
  rot?: V3;
  glow?: V3;
  map?: THREE.Texture | null;
  cast?: boolean;
  seg?: number;
  r2?: number;
}

export function Cy({ p, r, r2, h, c = '#888888', rough = 0.6, metal = 0, rot, glow, map, cast, seg = 20 }: CylProps) {
  return (
    <mesh position={p} rotation={rot} castShadow={cast}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      {glow ? (
        <meshBasicMaterial color={glow} toneMapped={false} />
      ) : (
        <meshStandardMaterial color={map ? '#ffffff' : c} roughness={rough} metalness={metal} map={map ?? undefined} envMapIntensity={ENV} />
      )}
    </mesh>
  );
}

interface SphProps {
  p: V3;
  r?: number;
  s?: V3;
  c: string;
  rough?: number;
  cast?: boolean;
  rot?: V3;
}

export function Sp({ p, r = 1, s = [1, 1, 1], c, rough = 0.95, cast, rot }: SphProps) {
  return (
    <mesh position={p} scale={s} rotation={rot} castShadow={cast}>
      <sphereGeometry args={[r, 24, 16]} />
      <meshStandardMaterial color={c} roughness={rough} envMapIntensity={ENV} />
    </mesh>
  );
}
