import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  ATX24,
  AUDIO_CODEC,
  BIOS_CHIPS,
  BUTTONS,
  CHIPSET,
  CMOS_BATTERY,
  HEADERS,
  LAN_CONTROLLER,
  PCIE_LENGTH,
  PCIE_SLOTS,
  PCIE_START_X,
  SATA_PORTS,
  SUPER_IO,
  USB3_HEADER,
  type Rect,
} from '../../scene/layout';
import { H, at, mm, rectCenter, rectSize, toX, toZ } from '../kit/space';
import { brushedTexture } from '../kit/canvasTexture';
import { place, useInstances, type Placement } from '../kit/instances';

const PLASTIC = { color: '#101112', roughness: 0.62 } as const;

function Instanced({ list, children, cast = true }: { list: Placement[]; children: React.ReactNode; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances(ref, list);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow={cast} receiveShadow>
      {children}
    </instancedMesh>
  );
}

/** PCIe slots: housings with a contact slit, key divider, steel armour and a latch on the x16 slots. */
function PcieSlots() {
  const brushed = useMemo(() => brushedTexture(), []);
  const W = mm(7.2);
  return (
    <group>
      {PCIE_SLOTS.map((s, i) => {
        const len = PCIE_LENGTH[s.kind];
        const cx = toX(PCIE_START_X + len / 2);
        const cz = toZ(s.y);
        const armoured = s.kind === 'x16';
        return (
          <group key={i}>
            <mesh position={[cx, H.pcieSlot / 2, cz]} castShadow receiveShadow>
              <boxGeometry args={[mm(len), H.pcieSlot, W]} />
              <meshStandardMaterial {...PLASTIC} />
            </mesh>
            {/* Contact slit, interrupted by the key divider 11.65 mm from the rear end. */}
            <mesh position={[toX(PCIE_START_X + 11.65 / 2), H.pcieSlot + 0.0003, cz]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[mm(10.6), mm(1.7)]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[toX(PCIE_START_X + 12.8 + (len - 13.6) / 2), H.pcieSlot + 0.0003, cz]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[mm(len - 13.6), mm(1.7)]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            {armoured && (
              <>
                {[-1, 1].map((side) => (
                  <mesh key={side} position={[cx, H.pcieSlot / 2 + mm(0.3), cz + side * (W / 2 + mm(0.25))]} castShadow>
                    <boxGeometry args={[mm(len + 1), H.pcieSlot - mm(0.6), mm(0.5)]} />
                    <meshStandardMaterial color="#b9bdc3" metalness={1} roughness={0.3} roughnessMap={brushed} />
                  </mesh>
                ))}
                <mesh position={[toX(PCIE_START_X + len + 3.2), mm(5), cz]} castShadow>
                  <boxGeometry args={[mm(6.4), mm(10), W * 0.9]} />
                  <meshStandardMaterial {...PLASTIC} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** PCH heat sink: low grooved block with a polished accent plate. */
function ChipsetSink() {
  const brushed = useMemo(() => brushedTexture(), []);
  const size = rectSize(CHIPSET);
  const c = rectCenter(CHIPSET);
  const grooves = useMemo(() => {
    const out: Placement[] = [];
    for (let i = 0; i < 12; i++) out.push(place(c[0], mm(10.2), c[2] - size.d / 2 + mm(3) + i * mm(3.1), size.w * 0.62, mm(3.2), mm(1.4)));
    return out;
  }, [c, size.w, size.d]);
  return (
    <group>
      <RoundedBox args={[size.w, mm(9), size.d]} radius={mm(1.5)} smoothness={3} position={[c[0], mm(4.5), c[2]]} castShadow receiveShadow>
        <meshStandardMaterial color="#2a2e34" metalness={0.85} roughness={0.42} roughnessMap={brushed} />
      </RoundedBox>
      <Instanced list={grooves}>
        <boxGeometry />
        <meshStandardMaterial color="#353a41" metalness={0.85} roughness={0.35} roughnessMap={brushed} />
      </Instanced>
      <mesh position={[c[0] + size.w * 0.34, mm(9.2), c[2]]} castShadow>
        <boxGeometry args={[size.w * 0.2, mm(0.6), size.d * 0.86]} />
        <meshStandardMaterial color="#c4c8ce" metalness={1} roughness={0.2} roughnessMap={brushed} />
      </mesh>
    </group>
  );
}

/** A shrouded connector with an array of square cavities on top. */
function Connector({ r, height, rows, cols, color = PLASTIC.color }: { r: Rect; height: number; rows: number; cols: number; color?: string }) {
  const size = rectSize(r);
  const c = rectCenter(r);
  const holes = useMemo(() => {
    const out: Placement[] = [];
    const px = size.w / cols;
    const pz = size.d / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        out.push(place(c[0] - size.w / 2 + px * (i + 0.5), height + mm(0.05), c[2] - size.d / 2 + pz * (j + 0.5), px * 0.66, mm(0.1), pz * 0.66));
    return out;
  }, [c, size.w, size.d, rows, cols, height]);
  return (
    <group>
      <mesh position={[c[0], height / 2, c[2]]} castShadow receiveShadow>
        <boxGeometry args={[size.w, height, size.d]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <Instanced list={holes} cast={false}>
        <boxGeometry />
        <meshBasicMaterial color="#030303" />
      </Instanced>
    </group>
  );
}

/** Right-angle SATA ports, stacked in pairs, opening toward the board edge. */
function SataPorts() {
  const bodies = useMemo(() => SATA_PORTS.map((r) => { const c = rectCenter(r); const s = rectSize(r); return place(c[0], mm(7), c[2], s.w, mm(14), s.d); }), []);
  const mouths = useMemo(
    () => SATA_PORTS.flatMap((r) => { const c = rectCenter(r); const s = rectSize(r); return [mm(3.8), mm(10.4)].map((y) => place(c[0] + s.w / 2 + mm(0.02), y, c[2], mm(0.1), mm(3.2), s.d * 0.72)); }),
    [],
  );
  return (
    <group>
      <Instanced list={bodies}>
        <boxGeometry />
        <meshStandardMaterial color="#15171a" roughness={0.55} />
      </Instanced>
      <Instanced list={mouths} cast={false}>
        <boxGeometry />
        <meshBasicMaterial color="#020202" />
      </Instanced>
    </group>
  );
}

/** Gold-pin headers on black plastic bases. */
function PinHeaders() {
  const { bases, pins } = useMemo(() => {
    const bases: Placement[] = [];
    const pins: Placement[] = [];
    for (const [x, y, n] of HEADERS) {
      const w = n * 2.54;
      bases.push(place(toX(x + w / 2 - 1.27), mm(1.25), toZ(y), mm(w), mm(2.5), mm(5.08)));
      for (let i = 0; i < n; i++) for (const dy of [-1.27, 1.27]) pins.push(place(toX(x + i * 2.54), mm(3.5), toZ(y + dy), mm(0.64), mm(6), mm(0.64)));
    }
    return { bases, pins };
  }, []);
  return (
    <group>
      <Instanced list={bases}>
        <boxGeometry />
        <meshStandardMaterial {...PLASTIC} />
      </Instanced>
      <Instanced list={pins}>
        <boxGeometry />
        <meshStandardMaterial color="#d6b56a" metalness={1} roughness={0.25} />
      </Instanced>
    </group>
  );
}

/** Quad flat packages with gull-wing leads (super I/O, audio codec), a QFN and two SOIC flash chips. */
function Ics() {
  const { bodies, leads } = useMemo(() => {
    const bodies: Placement[] = [];
    const leads: Placement[] = [];
    const quad = (r: Rect, pitch: number, h: number, withLeads: boolean) => {
      const c = rectCenter(r);
      const s = rectSize(r);
      bodies.push(place(c[0], mm(h / 2), c[2], s.w, mm(h), s.d));
      if (!withLeads) return;
      const n = Math.floor((r.width - 2) / pitch);
      for (let i = 0; i < n; i++) {
        const o = -((n - 1) * mm(pitch)) / 2 + i * mm(pitch);
        leads.push(place(c[0] + o, mm(0.25), c[2] - s.d / 2 - mm(0.6), mm(0.22), mm(0.2), mm(1.2)));
        leads.push(place(c[0] + o, mm(0.25), c[2] + s.d / 2 + mm(0.6), mm(0.22), mm(0.2), mm(1.2)));
        leads.push(place(c[0] - s.w / 2 - mm(0.6), mm(0.25), c[2] + o, mm(1.2), mm(0.2), mm(0.22)));
        leads.push(place(c[0] + s.w / 2 + mm(0.6), mm(0.25), c[2] + o, mm(1.2), mm(0.2), mm(0.22)));
      }
    };
    quad(SUPER_IO, 0.5, 1.4, true);
    quad(AUDIO_CODEC, 0.5, 1.4, true);
    quad(LAN_CONTROLLER, 0.5, 0.9, false);
    for (const r of BIOS_CHIPS) {
      const c = rectCenter(r);
      const s = rectSize(r);
      bodies.push(place(c[0], mm(0.75), c[2], s.w * 0.8, mm(1.5), s.d));
      for (let i = 0; i < 4; i++)
        for (const side of [-1, 1]) leads.push(place(c[0] + side * (s.w * 0.4 + mm(0.5)), mm(0.3), c[2] - mm(1.9) + i * mm(1.27), mm(1), mm(0.2), mm(0.4)));
    }
    return { bodies, leads };
  }, []);
  return (
    <group>
      <Instanced list={bodies}>
        <boxGeometry />
        <meshStandardMaterial color="#17181a" roughness={0.45} />
      </Instanced>
      <Instanced list={leads} cast={false}>
        <boxGeometry />
        <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.3} />
      </Instanced>
    </group>
  );
}

/** CR2032 coin cell in its holder. */
function Battery() {
  const p = at(CMOS_BATTERY);
  return (
    <group position={p}>
      <mesh position={[0, mm(1.25), 0]} castShadow receiveShadow>
        <cylinderGeometry args={[mm(11.5), mm(11.5), mm(2.5), 48]} />
        <meshStandardMaterial {...PLASTIC} />
      </mesh>
      <mesh position={[0, mm(2.5) + mm(1.6), 0]} castShadow>
        <cylinderGeometry args={[mm(10), mm(10), mm(3.2), 48]} />
        <meshStandardMaterial color="#d3d6da" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[mm(6), mm(5.9), 0]} castShadow>
        <boxGeometry args={[mm(4), mm(0.4), mm(5)]} />
        <meshStandardMaterial color="#c0c4c8" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Onboard power and reset buttons. */
function Buttons() {
  return (
    <group>
      {BUTTONS.map((b, i) => (
        <group key={i} position={at(b)}>
          <mesh position={[0, mm(1.5), 0]} castShadow receiveShadow>
            <boxGeometry args={[mm(8), mm(3), mm(8)]} />
            <meshStandardMaterial {...PLASTIC} />
          </mesh>
          <RoundedBox args={[mm(6), mm(2.4), mm(6)]} radius={mm(0.8)} smoothness={2} position={[0, mm(4), 0]} castShadow>
            <meshStandardMaterial color={i === 0 ? '#b3261e' : '#4a4f56'} roughness={0.4} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

/** Everything else soldered to the board: slots, chipset, connectors, ICs, battery, buttons. */
export default function Components() {
  return (
    <group>
      <PcieSlots />
      <ChipsetSink />
      <Connector r={ATX24} height={mm(13)} rows={12} cols={2} />
      <Connector r={USB3_HEADER} height={mm(9)} rows={10} cols={2} color="#1d4f9c" />
      <SataPorts />
      <PinHeaders />
      <Ics />
      <Battery />
      <Buttons />
    </group>
  );
}
