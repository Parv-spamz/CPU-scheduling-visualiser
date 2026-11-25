import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RAM_SLOT_COUNT, ramSlotRect } from '../scene/layout';
import { rt } from '../player/runtime';
import { queueLengthAt } from '../player/sceneState';
import { useApp } from '../store/useApp';
import { FONT_SIZE, H, rectCenter, rectSize } from './space';
import { FONTS } from './fonts';
import { damp } from './materials';

const LATCH = 0.12;

/** Eight DDR slots: the ready queue. Slot 0 (top) is the front of the queue. */
export default function RamBank() {
  const leds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const setTooltip = useApp((s) => s.setTooltip);

  useFrame((_, dt) => {
    const n = rt.run ? queueLengthAt(rt.run, rt.t) : 0;
    leds.current.forEach((m, i) => {
      if (!m) return;
      m.opacity = damp(m.opacity, i < n ? 1 : 0.08, 10, dt);
    });
  });

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setTooltip('RAM slots hold the ready queue: arrived processes waiting for the CPU. Slot A0 is the front.');
      }}
      onPointerOut={() => setTooltip('')}
    >
      {Array.from({ length: RAM_SLOT_COUNT }, (_, i) => {
        const r = ramSlotRect(i);
        const c = rectCenter(r);
        const s = rectSize(r);
        const body = s.w - LATCH * 2;
        return (
          <group key={i} position={[c[0], 0, c[2]]}>
            {/* Connector housing */}
            <mesh position={[0, H.ramSlot / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[body, H.ramSlot, s.d * 0.62]} />
              <meshStandardMaterial color="#17191c" roughness={0.48} />
            </mesh>
            {/* Groove with gold contacts */}
            <mesh position={[0, H.ramSlot + 0.0005, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[body * 0.98, s.d * 0.16]} />
              <meshStandardMaterial color="#050505" roughness={0.9} />
            </mesh>
            <mesh position={[0, H.ramSlot + 0.001, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[body * 0.95, s.d * 0.05]} />
              <meshStandardMaterial color="#d6ad55" metalness={1} roughness={0.25} />
            </mesh>
            {/* Latches */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * (body / 2 + LATCH / 2), H.ramSlot * 0.65, 0]} castShadow>
                <boxGeometry args={[LATCH, H.ramSlot * 1.3, s.d * 0.7]} />
                <meshStandardMaterial color="#d9dde0" roughness={0.4} />
              </mesh>
            ))}
            {/* Occupancy LED */}
            <mesh position={[-s.w / 2 - 0.08, 0.02, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.035, 20]} />
              <meshBasicMaterial
                ref={(m) => {
                  leds.current[i] = m;
                }}
                color={i === 0 ? [0.5, 3, 1] : [3, 1.8, 0.3]}
                transparent
                opacity={0.08}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      <Text
        font={FONTS.monoBold}
        fontSize={FONT_SIZE.small}
        position={rectCenter(ramSlotRect(0), 0.003).map((v, k) => (k === 0 ? v - rectSize(ramSlotRect(0)).w / 2 - 0.24 : k === 2 ? v : v)) as [number, number, number]}
        rotation-x={-Math.PI / 2}
        anchorX="right"
        anchorY="middle"
      >
        FRONT
        <meshBasicMaterial color={[0.5, 2.2, 1]} toneMapped={false} />
      </Text>
    </group>
  );
}
