import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DIMM_COUNT, DIMM_SLOT, DIMM_SLOT_COLORS, DIMM_X, RAM_SLOT, RAM_SLOT_COUNT, ramSlotCenter } from '../../scene/layout';
import { rt } from '../../player/runtime';
import { chipFrameAt, restingPlaceAt } from '../../player/sceneState';
import { useApp } from '../../store/useApp';
import { H, mm, toX, toZ } from '../kit/space';
import { brushedTexture } from '../kit/canvasTexture';
import { damp } from '../kit/materials';
import { describeProcess } from '../chips/describe';

const SLOT_W = mm(7.2);
const MODULE_T = mm(6.6);
const BAR_H = mm(5);
const IDLE = new THREE.Color('#e9eef5');
const tmp = new THREE.Color();

/** Which process (if any) is resting at each queue position right now. */
function occupants(): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: RAM_SLOT_COUNT }, () => null);
  const run = rt.run;
  const plan = rt.plan;
  if (!run || !plan) return out;
  for (const p of run.processes) {
    const f = chipFrameAt(plan, p.pid, rt.sec);
    if (f.move || f.pose.opacity <= 0) continue;
    const place = restingPlaceAt(plan, p.pid, rt.sec);
    if (place.kind === 'slot' && place.index < RAM_SLOT_COUNT) out[place.index] = p.pid;
  }
  return out;
}

/**
 * Four DDR slots with RGB memory modules installed. The ready queue is the modules' light bars: each
 * module has three segments, filled front to back (module nearest the CPU first, top segment first).
 */
export default function MemoryBank() {
  const brushed = useMemo(() => brushedTexture(), []);
  const segMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const who = useRef<(number | null)[]>([]);
  const colourCache = useRef<{ run: unknown; map: Map<number, string> }>({ run: null, map: new Map() });
  const setTooltip = useApp((s) => s.setTooltip);
  const selectPid = useApp((s) => s.selectPid);

  const slotLen = mm(DIMM_SLOT.length);
  const slotCz = toZ(DIMM_SLOT.top + DIMM_SLOT.length / 2);
  const modLen = mm(DIMM_SLOT.contactLength);
  const modCz = toZ(DIMM_SLOT.contactTop + DIMM_SLOT.contactLength / 2);

  useFrame((state, dt) => {
    const occ = occupants();
    who.current = occ;
    if (colourCache.current.run !== rt.run) {
      colourCache.current = { run: rt.run, map: new Map(rt.run?.processes.map((p) => [p.pid, p.color]) ?? []) };
    }
    const colours = colourCache.current.map;
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2);
    segMats.current.forEach((m, i) => {
      if (!m) return;
      const pid = occ[i] ?? null;
      if (pid !== null) {
        tmp.set(colours.get(pid) ?? '#ffffff');
        m.emissive.lerp(tmp, Math.min(1, dt * 10));
        m.emissiveIntensity = damp(m.emissiveIntensity, i === 0 ? 3.2 + pulse * 0.6 : 2.4, 8, dt);
      } else {
        m.emissive.lerp(IDLE, Math.min(1, dt * 6));
        m.emissiveIntensity = damp(m.emissiveIntensity, 0.05, 6, dt);
      }
    });
  });

  const onSegment = (i: number) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      const pid = who.current[i] ?? null;
      const run = rt.run;
      const p = pid !== null ? run?.processes.find((x) => x.pid === pid) : undefined;
      if (!p || !run) return;
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      setTooltip(`Waiting in the ready queue, position ${i + 1}. ${describeProcess(run, p, rt.t)}`);
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
      setTooltip('');
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const pid = who.current[i] ?? null;
      if (pid === null || e.delta > 6) return;
      e.stopPropagation();
      selectPid(pid);
    },
  });

  return (
    <group>
      {DIMM_X.slice(0, DIMM_COUNT).map((x, s) => (
        <group key={s} position={[toX(x), 0, 0]}>
          {/* Slot housing with latches at both ends. */}
          <mesh position={[0, H.dimmSlot / 2, slotCz]} castShadow receiveShadow>
            <boxGeometry args={[SLOT_W, H.dimmSlot, slotLen - mm(12)]} />
            <meshStandardMaterial color={DIMM_SLOT_COLORS[s]} roughness={0.5} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, mm(5), slotCz + side * (slotLen / 2 - mm(3))]} rotation-x={side * 0.12} castShadow>
              <boxGeometry args={[SLOT_W * 0.9, mm(10), mm(6)]} />
              <meshStandardMaterial color="#2a2d31" roughness={0.5} />
            </mesh>
          ))}

          {/* Memory module: PCB edge, heat spreaders, and the frosted light bar on top. */}
          <mesh position={[0, mm(4) + mm(15), modCz]} castShadow receiveShadow>
            <boxGeometry args={[mm(1.27), mm(30), modLen]} />
            <meshStandardMaterial color="#0f3a26" roughness={0.6} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * (MODULE_T / 2 - mm(1.2)), mm(4) + mm(16.5), modCz]} castShadow receiveShadow>
                <boxGeometry args={[mm(2.2), mm(33), modLen + mm(1)]} />
                <meshStandardMaterial color="#16181c" metalness={0.55} roughness={0.55} roughnessMap={brushed} envMapIntensity={0.35} />
              </mesh>
              {/* Machined accent stripe on each spreader. */}
              <mesh position={[side * (MODULE_T / 2 + mm(0.02)), mm(26), modCz - modLen * 0.12]} rotation-y={side * Math.PI / 2}>
                <planeGeometry args={[modLen * 0.6, mm(1.6)]} />
                <meshStandardMaterial color="#aeb3b9" metalness={1} roughness={0.25} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          {[0, 1, 2].map((k) => {
            const i = s * 3 + k;
            const c = ramSlotCenter(i);
            return (
              <mesh key={k} position={[0, H.dimmModule - BAR_H / 2, toZ(c.y)]} {...onSegment(i)}>
                <boxGeometry args={[MODULE_T * 0.82, BAR_H, mm(RAM_SLOT.height) - mm(1.2)]} />
                <meshStandardMaterial
                  ref={(m) => {
                    segMats.current[i] = m;
                  }}
                  color="#30343a"
                  roughness={0.4}
                  transparent
                  opacity={0.92}
                  emissive={IDLE}
                  emissiveIntensity={0.05}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}
