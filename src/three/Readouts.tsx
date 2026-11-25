import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { CLOCK_READOUT } from '../scene/layout';
import { useApp } from '../store/useApp';
import { rt } from '../player/runtime';
import { FONT_SIZE, H, rectCenter, rectSize } from './space';
import { FONTS } from './fonts';
import { COLORS, damp } from './materials';
import { brushedTexture } from './textures';

const BAR = 10;
const cold = new THREE.Color('#57ff8a');
const warm = new THREE.Color('#ffb347');

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/** Clock tick, context-switch counter and a thermal load bar, as a small display module. */
export default function Readouts() {
  const clock = useApp((s) => s.playhead.clock);
  const ctx = useApp((s) => s.playhead.contextSwitches);
  const setTooltip = useApp((s) => s.setTooltip);
  const leds = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const ctxFlash = useRef<THREE.MeshBasicMaterial>(null);
  const lastCtx = useRef(ctx);
  const brushed = useMemo(() => brushedTexture(), []);
  const c = rectCenter(CLOCK_READOUT);
  const s = rectSize(CLOCK_READOUT);
  const top = H.readout + 0.002;

  useFrame((_, dt) => {
    const lit = rt.load * BAR;
    leds.current.forEach((m, i) => {
      if (!m) return;
      const col = i < 5 ? cold : i < 8 ? warm : COLORS.hot;
      m.color.copy(col).multiplyScalar(2.4);
      m.opacity = damp(m.opacity, i < lit ? 1 : 0.1, 10, dt);
    });
    if (ctxFlash.current) {
      const now = useApp.getState().playhead.contextSwitches;
      if (now !== lastCtx.current) {
        if (now > lastCtx.current) ctxFlash.current.opacity = 0.9;
        lastCtx.current = now;
      }
      ctxFlash.current.opacity = damp(ctxFlash.current.opacity, 0, 6, dt);
    }
  });

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setTooltip('Clock tick, context switches so far, and CPU load (red when the ready queue backs up).');
      }}
      onPointerOut={() => setTooltip('')}
    >
      <RoundedBox args={[s.w, H.readout, s.d]} radius={0.025} smoothness={3} position={[c[0], H.readout / 2, c[2]]} castShadow receiveShadow>
        <meshStandardMaterial color="#2a2f35" metalness={0.95} roughness={0.36} roughnessMap={brushed} />
      </RoundedBox>
      <mesh position={[c[0], top - 0.001, c[2] - 0.03]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[s.w - 0.08, s.d - 0.16]} />
        <meshPhysicalMaterial color="#020405" roughness={0.1} clearcoat={1} />
      </mesh>
      <mesh position={[c[0] + s.w / 4, top, c[2] - 0.03]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[s.w / 2 - 0.08, s.d - 0.18]} />
        <meshBasicMaterial ref={ctxFlash} color={[3, 3, 3]} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      {[
        { label: 'CLK', value: pad(clock), x: c[0] - s.w / 4 },
        { label: 'CTX SW', value: pad(ctx), x: c[0] + s.w / 4 },
      ].map((r) => (
        <group key={r.label}>
          <Text font={FONTS.mono} fontSize={FONT_SIZE.small * 0.7} position={[r.x, top + 0.001, c[2] - s.d / 2 + 0.11]} rotation-x={-Math.PI / 2} anchorX="center" letterSpacing={0.12}>
            {r.label}
            <meshBasicMaterial color={[0.4, 1.1, 1.2]} toneMapped={false} />
          </Text>
          <Text font={FONTS.monoBold} fontSize={FONT_SIZE.readout} position={[r.x, top + 0.001, c[2] + 0.01]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle">
            {r.value}
            <meshBasicMaterial color={[0.6, 2.6, 3]} toneMapped={false} />
          </Text>
        </group>
      ))}
      {Array.from({ length: BAR }, (_, i) => {
        const bw = (s.w - 0.16) / BAR;
        return (
          <mesh key={i} position={[c[0] - s.w / 2 + 0.08 + bw * (i + 0.5), top, c[2] + s.d / 2 - 0.06]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[bw * 0.8, 0.035]} />
            <meshBasicMaterial
              ref={(m) => {
                leds.current[i] = m;
              }}
              transparent
              opacity={0.1}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
