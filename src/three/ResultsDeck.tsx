import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ALGORITHMS, ALGORITHM_LABEL, type AlgorithmId, type CompareResult, type RunResult } from '../engine/types';
import { RESULT_PANELS, RESULT_PANEL_SIZE, WORLD } from '../scene/layout';
import { algorithmExplanation, fmt2, ganttBlocks, modeLabel, ringLabel, sharedTimeAxis } from '../scene/resultsModel';
import { useApp } from '../store/useApp';
import { FONT_SIZE, H, U, at, toZ } from './space';
import { FONTS } from './fonts';
import { damp } from './materials';
import { brushedTexture, ihsTexture } from './textures';

const PW = RESULT_PANEL_SIZE.width * U;
const PD = RESULT_PANEL_SIZE.height * U;
const SLAB = 0.07;
/** Height of the slab's top face; content sits just above it. */
const TOP = SLAB / 2 + 0.006;

type Rank = 'winner' | 'runner' | 'other';

const FRAME: Record<Rank, [number, number, number]> = {
  winner: [3.2, 2.2, 0.5],
  runner: [1.6, 1.7, 1.8],
  other: [0.25, 0.9, 1.05],
};

function backOut(u: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, u));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface PanelProps {
  id: AlgorithmId;
  index: number;
  run: RunResult;
  rank: Rank;
  axis: { t0: number; span: number };
  progress: { current: number };
}

function MiniCpu({ id, label }: { id: AlgorithmId; label: string }) {
  const tex = useMemo(() => ({ ihs: ihsTexture(), brushed: brushedTexture() }), []);
  return (
    <group>
      <RoundedBox args={[1.25, 0.06, 1.25]} radius={0.02} position={[0, TOP + 0.03, 0]} castShadow>
        <meshStandardMaterial color="#121416" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, TOP + 0.07, 0]} castShadow>
        <boxGeometry args={[1.08, 0.02, 1.08]} />
        <meshStandardMaterial color="#1f4d34" roughness={0.5} />
      </mesh>
      <RoundedBox args={[0.9, 0.05, 0.9]} radius={0.012} position={[0, TOP + 0.105, 0]} castShadow>
        <meshPhysicalMaterial color="#d4d7db" map={tex.ihs} metalness={1} roughness={0.32} roughnessMap={tex.brushed} />
      </RoundedBox>
      <Text font={FONTS.sansBold} fontSize={0.2} position={[0, TOP + 0.132, 0.02]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle" maxWidth={0.8}>
        {label}
        <meshBasicMaterial color="#2c3036" />
      </Text>
      <Text font={FONTS.mono} fontSize={0.06} position={[0, TOP + 0.132, 0.25]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle">
        {`U${ALGORITHMS.indexOf(id) + 1} · SCHED CORE`}
        <meshBasicMaterial color="#4a4f56" />
      </Text>
    </group>
  );
}

function Panel({ id, index, run, rank, axis, progress }: PanelProps) {
  const group = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  const setLevel = useApp((s) => s.setLevel);
  const play = useApp((s) => s.play);
  const setTooltip = useApp((s) => s.setTooltip);
  const settings = run.settings;
  const origin = RESULT_PANELS[index];
  const centre = at({ x: origin.x + RESULT_PANEL_SIZE.width / 2, y: origin.y + RESULT_PANEL_SIZE.height / 2 });
  const frame = FRAME[rank];
  const colours = useMemo(() => new Map(run.processes.map((p) => [p.pid, new THREE.Color(p.color).multiplyScalar(1.6)])), [run]);
  const gx = -PW * 0.44;
  const gw = PW * 0.88;
  const blocks = ganttBlocks(run.segments, axis.t0, axis.span, gx, gw);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const local = (progress.current - index * 0.07) / 0.79;
    const e = backOut(local);
    g.visible = local > 0.005;
    g.scale.setScalar(Math.max(0.001, e));
    g.position.y = THREE.MathUtils.lerp(0.4, H.resultsFloat, Math.min(1, local));
    if (gem.current) gem.current.rotation.y = state.clock.elapsedTime * 1.4;
  });

  const stats: { label: string; value: string }[] = [
    { label: 'AVG WAIT', value: fmt2(run.averages.waiting) },
    { label: 'AVG TURNAROUND', value: fmt2(run.averages.turnaround) },
    { label: 'AVG RESPONSE', value: fmt2(run.averages.response) },
    { label: 'CONTEXT SW', value: String(run.contextSwitches) },
  ];

  const open = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setAlgorithm(id);
    setLevel('L1');
    play();
  };

  return (
    <group position={[centre[0], 0, centre[2]]}>
      <group
        ref={group}
        visible={false}
        onClick={open}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          setTooltip(`${algorithmExplanation(id, settings)} Click to replay it.`);
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
          setTooltip('');
        }}
      >
        <RoundedBox args={[PW * 0.96, SLAB, PD * 0.92]} radius={0.03} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color="#010304" roughness={0.6} metalness={0} envMapIntensity={0.08} />
        </RoundedBox>
        {/* Glowing edge frame: gold for the winner. */}
        {[
          [0, -PD * 0.46, PW * 0.96, 0.02],
          [0, PD * 0.46, PW * 0.96, 0.02],
          [-PW * 0.48, 0, 0.02, PD * 0.92],
          [PW * 0.48, 0, 0.02, PD * 0.92],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, TOP + 0.002, z]}>
            <boxGeometry args={[w, 0.01, d]} />
            <meshBasicMaterial color={frame} toneMapped={false} />
          </mesh>
        ))}

        <group position={[-PW * 0.33, 0, -PD * 0.1]}>
          <MiniCpu id={id} label={ringLabel(id, settings)} />
        </group>

        <Text font={FONTS.sansBold} fontSize={0.3} position={[-PW * 0.16, TOP + 0.004, -PD * 0.33]} rotation-x={-Math.PI / 2} anchorX="left" anchorY="middle">
          {ALGORITHM_LABEL[id]}
          <meshBasicMaterial color={[1.4, 1.45, 1.5]} toneMapped={false} />
        </Text>
        <Text font={FONTS.mono} fontSize={0.12} position={[-PW * 0.16, TOP + 0.004, -PD * 0.23]} rotation-x={-Math.PI / 2} anchorX="left" anchorY="middle" letterSpacing={0.06}>
          {`${modeLabel(id, settings)} · util ${Math.round(run.utilisation * 100)}% · makespan ${run.makespan}`}
          <meshBasicMaterial color={[0.45, 1.2, 1.3]} toneMapped={false} />
        </Text>

        {stats.map((s, i) => {
          const x = -PW * 0.16 + (i % 2) * PW * 0.31;
          const z = -PD * 0.09 + Math.floor(i / 2) * PD * 0.2;
          const highlight = i === 0;
          return (
            <group key={s.label}>
              <Text font={FONTS.mono} fontSize={0.09} position={[x, TOP + 0.004, z - 0.15]} rotation-x={-Math.PI / 2} anchorX="left" anchorY="middle" letterSpacing={0.1}>
                {s.label}
                <meshBasicMaterial color={[0.6, 0.8, 0.85]} toneMapped={false} />
              </Text>
              <Text font={FONTS.monoBold} fontSize={0.34} position={[x, TOP + 0.004, z + 0.06]} rotation-x={-Math.PI / 2} anchorX="left" anchorY="middle">
                {s.value}
                <meshBasicMaterial color={highlight ? (rank === 'winner' ? [3, 2.2, 0.6] : [0.6, 2.4, 2.8]) : [1.3, 1.35, 1.4]} toneMapped={false} />
              </Text>
            </group>
          );
        })}

        {/* Mini logic-analyser trace on the shared time axis. */}
        <mesh position={[0, TOP + 0.002, PD * 0.33]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[gw + 0.06, 0.3]} />
          <meshBasicMaterial color="#020607" />
        </mesh>
        {blocks.map((b, i) => (
          <mesh key={i} position={[b.x + b.width / 2, TOP + 0.01, PD * 0.33]}>
            <boxGeometry args={[Math.max(0.004, b.width - 0.006), 0.012, 0.22]} />
            <meshBasicMaterial color={b.pid === null ? [0.08, 0.1, 0.11] : (colours.get(b.pid) ?? new THREE.Color('#888'))} toneMapped={false} />
          </mesh>
        ))}

        {rank === 'winner' && (
          <group position={[PW * 0.36, TOP, -PD * 0.32]}>
            <mesh ref={gem} position={[-0.55, 0.16, 0]} castShadow>
              <octahedronGeometry args={[0.11, 0]} />
              <meshPhysicalMaterial color="#ffd36b" metalness={1} roughness={0.15} emissive="#ffb000" emissiveIntensity={1.6} />
            </mesh>
            <Text font={FONTS.sansBold} fontSize={0.2} position={[0, 0.005, 0]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle" letterSpacing={0.12}>
              WINNER
              <meshBasicMaterial color={[3.2, 2.3, 0.6]} toneMapped={false} />
            </Text>
            <pointLight position={[0, 0.6, 0]} color="#ffc94d" intensity={2.5} distance={3} />
          </group>
        )}
        {rank === 'runner' && (
          <Text font={FONTS.sansBold} fontSize={0.13} position={[PW * 0.36, TOP + 0.005, -PD * 0.32]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle" letterSpacing={0.12}>
            RUNNER-UP
            <meshBasicMaterial color={[1.5, 1.55, 1.6]} toneMapped={false} />
          </Text>
        )}
      </group>
    </group>
  );
}

function rankOf(compare: CompareResult, id: AlgorithmId): Rank {
  if (compare.winner === id) return 'winner';
  if (compare.runnerUp === id) return 'runner';
  return 'other';
}

/** Results level (L3): four mini-CPUs rise over the board with a winner badge and the verdict. */
export default function ResultsDeck() {
  const compare = useApp((s) => s.compare);
  const progress = useRef({ current: 0 });
  const overlay = useRef<THREE.MeshBasicMaterial>(null);
  const verdict = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const s = useApp.getState();
    const target = s.level === 'L3' && s.compare ? 1 : 0;
    progress.current.current = damp(progress.current.current, target, s.reducedMotion ? 14 : 2.6, dt);
    const p = progress.current.current;
    if (overlay.current) {
      overlay.current.opacity = p * 0.62;
      overlay.current.visible = p > 0.005;
    }
    if (verdict.current) {
      const v = Math.max(0, (p - 0.35) / 0.65);
      verdict.current.visible = v > 0.01;
      verdict.current.scale.setScalar(Math.max(0.001, backOut(v)));
    }
  });

  const axis = useMemo(() => (compare ? sharedTimeAxis(ALGORITHMS.map((a) => compare.runs[a])) : { t0: 0, span: 0 }), [compare]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.45, 0]} renderOrder={5}>
        <planeGeometry args={[WORLD.width * U, WORLD.height * U]} />
        <meshBasicMaterial ref={overlay} color="#010303" transparent opacity={0} depthWrite={false} />
      </mesh>
      {compare &&
        ALGORITHMS.map((id, i) => (
          <Panel key={id} id={id} index={i} run={compare.runs[id]} rank={rankOf(compare, id)} axis={axis} progress={progress.current} />
        ))}
      {compare && (
        <group ref={verdict} position={[0, H.resultsFloat + 0.05, toZ((RESULT_PANELS[0].y + RESULT_PANEL_SIZE.height + RESULT_PANELS[2].y) / 2)]} visible={false}>
          <RoundedBox args={[12.4, 0.04, 0.42]} radius={0.02}>
            <meshPhysicalMaterial color="#020506" roughness={0.3} clearcoat={0.6} envMapIntensity={0.18} />
          </RoundedBox>
          <Text font={FONTS.sans} fontSize={FONT_SIZE.label * 1.25} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} anchorX="center" anchorY="middle" maxWidth={12}>
            {compare.reason}
            <meshBasicMaterial color={[1.6, 1.6, 1.55]} toneMapped={false} />
          </Text>
        </group>
      )}
    </group>
  );
}
