// The few things left on the bed next to the board: headphones, a phone and a paperback.
// Sizes are real at 0.05 world units per mm, so they match the board's own parts.
import { useMemo } from 'react';
import * as THREE from 'three';
import { B, type V3 } from './parts';
import { blobTexture, phoneTexture } from './roomTextures';

/** Soft dark contact shadow under an object: the ambient occlusion the shadow map is too coarse to draw. */
function Blob({ w, d, o = 0.5, p = [0, 0.05, 0] }: { w: number; d: number; o?: number; p?: V3 }) {
  const tex = useMemo(() => blobTexture(), []);
  return (
    <mesh position={p} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={tex} color="#000000" transparent opacity={o} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function Place({ p, ry = 0, children }: { p: V3; ry?: number; children: React.ReactNode }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      {children}
    </group>
  );
}

const CUP = new THREE.LatheGeometry(
  [
    [0, 0],
    [1.9, 0],
    [2.25, 0.35],
    [2.4, 1.2],
    [2.25, 2.0],
    [1.75, 2.5],
    [0, 2.58],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  36,
);

/** Over-ear headphones lying flat: lathed shells, leatherette pads, a padded band and a metal accent ring. */
function Headphones() {
  return (
    <group>
      <Blob w={20} d={11} o={0.55} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 4.5, 0.45, 0]}>
          <mesh geometry={CUP} castShadow>
            <meshStandardMaterial color="#1c1e24" roughness={0.42} metalness={0.15} envMapIntensity={0.7} />
          </mesh>
          <mesh position={[0, -0.05, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 0.8]}>
            <torusGeometry args={[1.75, 0.5, 14, 36]} />
            <meshStandardMaterial color="#121316" roughness={0.78} envMapIntensity={0.3} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[1.25, 1.25, 0.08, 32]} />
            <meshStandardMaterial color="#9aa0a8" roughness={0.28} metalness={0.95} envMapIntensity={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.4, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[4.5, 0.3, 10, 40, Math.PI]} />
        <meshStandardMaterial color="#8a9098" roughness={0.3} metalness={0.9} envMapIntensity={0.8} />
      </mesh>
      <mesh position={[0, 2.1, -4.5]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]} castShadow>
        <capsuleGeometry args={[0.55, 3.4, 6, 14]} />
        <meshStandardMaterial color="#14161a" roughness={0.75} envMapIntensity={0.3} />
      </mesh>
      <mesh position={[-6.9, 0.2, 2.2]} rotation={[Math.PI / 2, 0, 0.4]}>
        <torusGeometry args={[2.6, 0.1, 6, 22, Math.PI * 1.25]} />
        <meshLambertMaterial color="#14161a" />
      </mesh>
    </group>
  );
}

/** A phone lying screen up: aluminium rim, black glass, a dim lock screen. */
function Phone() {
  const tex = useMemo(() => phoneTexture(), []);
  return (
    <group>
      <Blob w={6.4} d={10} o={0.6} />
      <B p={[0, 0.38, 0]} s={[3.6, 0.76, 7.4]} c="#7b8088" m={0.85} r={0.32} round={0.38} cast />
      <B p={[0, 0.7, 0]} s={[3.4, 0.14, 7.2]} c="#06070a" r={0.12} round={0.34} />
      <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.1, 6.9]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A closed hardback: two boards, a spine and a page block set in from the edges (no coplanar faces). */
function Book() {
  return (
    <group>
      <Blob w={10.4} d={13.6} o={0.6} />
      <B p={[0, 0.07, 0]} s={[6.4, 0.14, 9.6]} c="#34433f" r={0.85} cast />
      <B p={[0, 1.03, 0]} s={[6.4, 0.14, 9.6]} c="#34433f" r={0.85} cast />
      <B p={[-3.14, 0.55, 0]} s={[0.16, 1.08, 9.56]} c="#2b3834" r={0.8} />
      <B p={[0.1, 0.55, 0]} s={[6.0, 0.88, 9.3]} c="#e3dccb" r={0.95} />
      <B p={[-1.2, 1.115, 1.2]} s={[2.2, 0.02, 1.4]} c="#c9c0a4" r={0.7} />
    </group>
  );
}

/** Everything on the duvet, placed around the board (which fills x ±6.1, z ±7.6). Three items, nothing more. */
export default function BedProps() {
  return (
    <group>
      <Place p={[-15, 0, 6]} ry={0.45}>
        <Headphones />
      </Place>
      <Place p={[13.6, 0, 4.5]} ry={0.35}>
        <Phone />
      </Place>
      <Place p={[-16.5, 0, -6.5]} ry={0.25}>
        <Book />
      </Place>
    </group>
  );
}
