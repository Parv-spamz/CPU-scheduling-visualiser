import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { GANTT, GANTT_LANE, ganttX } from '../scene/layout';
import { useApp } from '../store/useApp';
import { rt } from '../player/runtime';
import { timeOrigin } from '../player/keyframes';
import { FONT_SIZE, H, U, rectCenter, rectSize, toX, toZ } from './space';
import { FONTS } from './fonts';
import { brushedTexture } from './textures';

type TextMesh = THREE.Mesh & { fillOpacity: number };

const SCREEN_Y = H.analyzer + 0.002;
const segGeo = (() => {
  const g = new THREE.BoxGeometry(1, 0.008, 1);
  g.translate(0.5, 0, 0);
  return g;
})();

function tickStep(span: number): number {
  if (span <= 24) return 1;
  if (span <= 60) return 5;
  return 10;
}

/** The Gantt chart as a logic-analyser probe: segments grow with the playback clock. */
export default function Analyzer() {
  const run = useApp((s) => s.run);
  const setTooltip = useApp((s) => s.setTooltip);
  const segs = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<(TextMesh | null)[]>([]);
  const cursor = useRef<THREE.Group>(null);
  const brushed = useMemo(() => brushedTexture(), []);

  const c = rectCenter(GANTT);
  const s = rectSize(GANTT);
  const laneZ = toZ(GANTT.y + GANTT_LANE.top + GANTT_LANE.height / 2);
  const laneD = GANTT_LANE.height * U;

  const model = useMemo(() => {
    if (!run) return null;
    const t0 = timeOrigin(run);
    const span = Math.max(1, run.makespan);
    const step = tickStep(span);
    const ticks: number[] = [];
    for (let t = 0; t <= span; t += step) ticks.push(t0 + t);
    const colours = new Map(run.processes.map((p) => [p.pid, p.color]));
    const names = new Map(run.processes.map((p) => [p.pid, p.name]));
    return {
      t0,
      span,
      ticks,
      segments: run.segments.map((seg) => ({
        ...seg,
        x0: toX(ganttX(seg.start, t0, span)),
        w: (ganttX(seg.end, t0, span) - ganttX(seg.start, t0, span)) * U,
        colour: seg.pid === null ? null : new THREE.Color(colours.get(seg.pid) ?? '#888').multiplyScalar(1.15),
        name: seg.pid === null ? 'idle' : (names.get(seg.pid) ?? ''),
      })),
    };
  }, [run]);

  useFrame(() => {
    if (!model) return;
    const t = rt.t;
    model.segments.forEach((seg, i) => {
      const m = segs.current[i];
      const frac = Math.max(0, Math.min(1, (t - seg.start) / Math.max(1e-6, seg.end - seg.start)));
      if (m) {
        m.visible = frac > 0.001;
        m.scale.x = Math.max(1e-4, seg.w * frac);
      }
      const l = labels.current[i];
      if (l) l.fillOpacity = frac >= 0.999 && seg.w > 0.22 ? 1 : 0;
    });
    if (cursor.current) {
      const clamped = Math.max(model.t0, Math.min(model.t0 + model.span, t));
      cursor.current.position.x = toX(ganttX(clamped, model.t0, model.span));
    }
  });

  const hoverSeg = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const seg = model?.segments[i];
    if (!seg) return;
    setTooltip(`${seg.pid === null ? 'CPU idle' : seg.name}: ${seg.start} → ${seg.end} (${seg.end - seg.start} tick${seg.end - seg.start === 1 ? '' : 's'})`);
  };

  return (
    <group>
      <RoundedBox args={[s.w + 0.14, H.analyzer, s.d + 0.14]} radius={0.03} smoothness={3} position={[c[0], H.analyzer / 2, c[2]]} castShadow receiveShadow>
        <meshStandardMaterial color="#2a2f35" metalness={0.95} roughness={0.38} roughnessMap={brushed} />
      </RoundedBox>
      <mesh position={[c[0], H.analyzer + 0.001, c[2]]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[s.w, s.d]} />
        <meshPhysicalMaterial color="#020506" roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} emissive="#04161a" emissiveIntensity={0.6} />
      </mesh>
      {model && (
        <>
          {/* Grid and tick numbers */}
          {model.ticks.map((t) => {
            const x = toX(ganttX(t, model.t0, model.span));
            return (
              <group key={t}>
                <mesh position={[x, SCREEN_Y, c[2] - 0.08]} rotation-x={-Math.PI / 2}>
                  <planeGeometry args={[0.006, s.d * 0.62]} />
                  <meshBasicMaterial color={[0.12, 0.45, 0.5]} toneMapped={false} />
                </mesh>
                <Text
                  font={FONTS.mono}
                  fontSize={FONT_SIZE.small * 0.8}
                  position={[x, SCREEN_Y, toZ(GANTT.y + GANTT.height) - 0.12]}
                  rotation-x={-Math.PI / 2}
                  anchorX="center"
                  anchorY="middle"
                >
                  {String(t)}
                  <meshBasicMaterial color={[0.45, 1.3, 1.4]} toneMapped={false} />
                </Text>
              </group>
            );
          })}
          {/* Segments */}
          {model.segments.map((seg, i) => (
            <group key={i}>
              <mesh
                ref={(m) => {
                  segs.current[i] = m;
                }}
                geometry={segGeo}
                position={[seg.x0, SCREEN_Y + 0.004, laneZ]}
                scale={[1e-4, 1, laneD]}
                visible={false}
                onPointerOver={hoverSeg(i)}
                onPointerOut={() => setTooltip('')}
              >
                {seg.colour ? (
                  <meshBasicMaterial color={seg.colour} toneMapped={false} />
                ) : (
                  <meshBasicMaterial color={[0.08, 0.1, 0.11]} toneMapped={false} />
                )}
              </mesh>
              <Text
                ref={(m: TextMesh | null) => {
                  labels.current[i] = m;
                }}
                font={FONTS.monoBold}
                fontSize={FONT_SIZE.small * 0.9}
                position={[seg.x0 + seg.w / 2, SCREEN_Y + 0.012, laneZ]}
                rotation-x={-Math.PI / 2}
                anchorX="center"
                anchorY="middle"
                fillOpacity={0}
              >
                {seg.name}
                <meshBasicMaterial color={seg.pid === null ? [0.6, 0.7, 0.72] : [0.02, 0.03, 0.04]} toneMapped={false} transparent />
              </Text>
            </group>
          ))}
          {/* Playhead cursor */}
          <group ref={cursor} position={[toX(GANTT.x), 0, 0]}>
            <mesh position={[0, SCREEN_Y + 0.01, c[2] - 0.06]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.012, s.d * 0.78]} />
              <meshBasicMaterial color={[2.6, 3, 3]} toneMapped={false} />
            </mesh>
          </group>
          <Text
            font={FONTS.monoBold}
            fontSize={FONT_SIZE.small * 0.85}
            position={[toX(GANTT.x) + 0.06, SCREEN_Y, toZ(GANTT.y) + 0.1]}
            rotation-x={-Math.PI / 2}
            anchorX="left"
            anchorY="middle"
            letterSpacing={0.08}
          >
            {`CH1 CPU0 · ${run?.algorithm.toUpperCase() ?? ''} · makespan ${model.span}`}
            <meshBasicMaterial color={[0.45, 1.3, 1.4]} toneMapped={false} />
          </Text>
        </>
      )}
    </group>
  );
}
