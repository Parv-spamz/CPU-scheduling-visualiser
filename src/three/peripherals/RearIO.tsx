import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REAR_IO, type IoKind, type Rect } from '../../scene/layout';
import { rt } from '../../player/runtime';
import { mm, rectCenter, rectSize } from '../kit/space';
import { brushedTexture } from '../kit/canvasTexture';
import { damp } from '../kit/materials';

const STEEL = { color: '#c3c7cc', metalness: 1, roughness: 0.32 } as const;
const AUDIO_RINGS = ['#9be15d', '#ff7fb0', '#55a8ff', '#ff9a3c', '#202225', '#9aa0a6'];

/** Seconds since the most recent exit animation started (finished processes leaving the board). */
function sinceExit(): number {
  const plan = rt.plan;
  if (!plan) return Infinity;
  let best = Infinity;
  for (const moves of plan.moves.values())
    for (const m of moves) if (m.kind === 'exit' && m.start <= rt.sec) best = Math.min(best, rt.sec - m.start);
  return best;
}

/** Openings on the rear (-x) face of a port block. */
function Face({ r, height, kind }: { r: Rect; height: number; kind: IoKind }) {
  const s = rectSize(r);
  const c = rectCenter(r);
  const fx = c[0] - s.w / 2 - mm(0.05);
  const hole = (y: number, z: number, w: number, h: number, key: string, color = '#030303') => (
    <mesh key={key} position={[fx, y, c[2] + z]} rotation-y={-Math.PI / 2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
  switch (kind) {
    case 'ps2':
      return (
        <group>
          <mesh position={[fx, height * 0.5, c[2]]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[mm(4.6), mm(4.6), mm(0.2), 32]} />
            <meshStandardMaterial color="#6d4c9e" roughness={0.5} />
          </mesh>
          <mesh position={[fx - mm(0.1), height * 0.5, c[2]]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[mm(3.2), mm(3.2), mm(0.2), 32]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
        </group>
      );
    case 'usb2':
    case 'usb3':
      return (
        <group>
          {[height * 0.3, height * 0.72].map((y, i) => (
            <group key={i}>
              {hole(y, 0, mm(12.5), mm(5), `o${i}`)}
              <mesh position={[fx - mm(0.06), y - mm(0.6), c[2]]} rotation-y={-Math.PI / 2}>
                <planeGeometry args={[mm(10.5), mm(1.8)]} />
                <meshBasicMaterial color={kind === 'usb3' ? '#2a62d8' : '#141414'} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'lan':
      return <group>{hole(height * 0.72, 0, mm(13.5), mm(11.5), 'rj')}{hole(height * 0.22, 0, mm(12.5), mm(5), 'usb')}</group>;
    case 'audio':
      return (
        <group>
          {AUDIO_RINGS.map((col, i) => {
            const row = i % 3;
            const colIdx = Math.floor(i / 3);
            const y = height * (0.22 + row * 0.28);
            const z = (colIdx === 0 ? -1 : 1) * s.d * 0.24;
            return (
              <group key={i}>
                <mesh position={[fx, y, c[2] + z]} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[mm(3.6), mm(3.6), mm(0.2), 28]} />
                  <meshStandardMaterial color={col} roughness={0.4} />
                </mesh>
                <mesh position={[fx - mm(0.1), y, c[2] + z]} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[mm(1.8), mm(1.8), mm(0.2), 20]} />
                  <meshBasicMaterial color="#020202" />
                </mesh>
              </group>
            );
          })}
        </group>
      );
  }
}

/**
 * Rear I/O stack along the board's rear edge. Finished processes leave through the network port,
 * whose activity LED blinks as each one goes.
 */
export default function RearIO() {
  const brushed = useMemo(() => brushedTexture(), []);
  const act = useRef<THREE.MeshBasicMaterial>(null);
  const link = useRef<THREE.MeshBasicMaterial>(null);
  const lan = REAR_IO.find((p) => p.kind === 'lan')!;
  const lc = rectCenter(lan.rect);
  const ls = rectSize(lan.rect);

  useFrame((state, dt) => {
    const dtExit = sinceExit();
    const blink = dtExit < 0.9 ? (Math.sin(state.clock.elapsedTime * 38) > 0 ? 1 : 0.15) : 0;
    if (act.current) act.current.opacity = damp(act.current.opacity, blink, 30, dt);
    if (link.current) link.current.opacity = rt.run ? 1 : 0.1;
  });

  return (
    <group>
      {REAR_IO.map((p, i) => {
        const s = rectSize(p.rect);
        const h = mm(p.height);
        const c = rectCenter(p.rect, h / 2);
        const metal = p.kind !== 'audio' && p.kind !== 'ps2';
        return (
          <group key={i}>
            <mesh position={c} castShadow receiveShadow>
              <boxGeometry args={[s.w, h, s.d]} />
              {metal ? (
                <meshStandardMaterial {...STEEL} roughnessMap={brushed} />
              ) : (
                <meshStandardMaterial color="#121314" roughness={0.6} />
              )}
            </mesh>
            <Face r={p.rect} height={h} kind={p.kind} />
          </group>
        );
      })}
      {/* Link (green) and activity (amber) LEDs on the network jack. */}
      {[
        { z: -ls.d * 0.36, ref: link, color: [0.4, 3, 0.6] as [number, number, number] },
        { z: ls.d * 0.36, ref: act, color: [3.2, 1.8, 0.3] as [number, number, number] },
      ].map((l, i) => (
        <mesh key={i} position={[lc[0] - ls.w / 2 - mm(0.12), mm(lan.height) * 0.9, lc[2] + l.z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[mm(2.4), mm(1.6)]} />
          <meshBasicMaterial ref={l.ref} color={l.color} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
