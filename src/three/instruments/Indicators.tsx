import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PHASE_LEDS, POST_DISPLAY } from '../../scene/layout';
import { rt } from '../../player/runtime';
import { useApp } from '../../store/useApp';
import { at, mm, rectCenter, rectSize } from '../kit/space';
import { damp } from '../kit/materials';

// Seven-segment layout per digit: [cx, cy, horizontal] in a 1 x 2 cell (y grows downward).
const SEGS: [number, number, boolean][] = [
  [0.5, 0, true], [1, 0.5, false], [1, 1.5, false], [0.5, 2, true], [0, 1.5, false], [0, 0.5, false], [0.5, 1, true],
];
const DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

/** Two-digit debug LED display: here it counts context switches (last two digits). */
function PostCode() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const c = rectCenter(POST_DISPLAY);
  const s = rectSize(POST_DISPLAY);
  const cell = mm(2.6);
  useFrame((_, dt) => {
    const n = useApp.getState().playhead.contextSwitches % 100;
    const lit = [Math.floor(n / 10), n % 10].map((d) => DIGITS[d]!);
    mats.current.forEach((m, i) => {
      if (!m) return;
      const digit = Math.floor(i / 7);
      const seg = 'abcdefg'[i % 7]!;
      m.opacity = damp(m.opacity, lit[digit]!.includes(seg) ? 1 : 0.06, 20, dt);
    });
  });
  return (
    <group>
      <mesh position={[c[0], mm(1.2), c[2]]} castShadow receiveShadow>
        <boxGeometry args={[s.w, mm(2.4), s.d]} />
        <meshStandardMaterial color="#0c0c0d" roughness={0.2} />
      </mesh>
      {[0, 1].map((d) =>
        SEGS.map(([sx, sy, horiz], k) => {
          const x = c[0] - mm(3.4) + d * mm(4.6) + (sx - 0.5) * cell;
          const z = c[2] + (sy - 1) * cell;
          return (
            <mesh key={`${d}-${k}`} position={[x, mm(2.42), z]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={horiz ? [cell * 0.8, mm(0.45)] : [mm(0.45), cell * 0.8]} />
              <meshBasicMaterial
                ref={(m) => {
                  mats.current[d * 7 + k] = m;
                }}
                color={[3.2, 0.25, 0.15]}
                transparent
                opacity={0.06}
                toneMapped={false}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

const GREEN = new THREE.Color(0.3, 2.6, 0.6);
const AMBER = new THREE.Color(3, 1.6, 0.2);
const RED = new THREE.Color(3.4, 0.25, 0.15);

/** CPU power-phase LEDs above the VRM: more light up as the CPU gets busier. */
function PhaseLeds() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame((_, dt) => {
    const lit = rt.load * PHASE_LEDS.length;
    mats.current.forEach((m, i) => {
      if (!m) return;
      const f = i / (PHASE_LEDS.length - 1);
      m.color.copy(f < 0.5 ? GREEN : f < 0.8 ? AMBER : RED);
      m.opacity = damp(m.opacity, i < Math.max(1, Math.round(lit)) ? 1 : 0.05, 10, dt);
    });
  });
  return (
    <group>
      {PHASE_LEDS.map((p, i) => (
        <group key={i} position={at(p)}>
          <mesh position={[0, mm(0.3), 0]}>
            <boxGeometry args={[mm(1.6), mm(0.6), mm(0.8)]} />
            <meshStandardMaterial color="#e8e8e0" roughness={0.3} />
          </mesh>
          <mesh position={[0, mm(0.62), 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[mm(1.5), mm(0.75)]} />
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i] = m;
              }}
              transparent
              opacity={0.05}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Indicators() {
  return (
    <group>
      <PostCode />
      <PhaseLeds />
    </group>
  );
}
