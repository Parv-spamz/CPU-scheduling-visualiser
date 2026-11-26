import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { radialGlowTexture } from '../kit/materials';
import { place, useInstances, type Placement } from '../kit/instances';
import { B, Cy, type V3 } from './parts';
import BedProps from './BedProps';
import { deckTexture, duvetMaps, nightSkyTexture, posterTexture, rugTexture, screenTexture, wallAoTexture } from './roomTextures';
import { usePbr } from './pbr';
import { curtainGeometry, duvetGeometry, pillowGeometry, vaseGeometry } from './shapes';

/** Room bounds in world units (0.05 per mm). The bed's duvet top is y = 0, the board lies on it. */
export const ROOM = { x0: -40, x1: 40, z0: -28, z1: 60, floor: -26, ceil: 30 } as const;

const TRIM = '#cfd6df';
const PAINT = '#7d8da2';
const WOOD = '#6b4a32';

function Shell() {
  const floor = usePbr('brown_planks_03', 4, 4.4);
  const plasterBack = usePbr('plastered_wall_02', 4, 2.8, true);
  const plasterSide = usePbr('plastered_wall_02', 4.4, 2.8, true);
  const ao = useMemo(() => wallAoTexture(), []);
  const w = ROOM.x1 - ROOM.x0;
  const d = ROOM.z1 - ROOM.z0;
  const h = ROOM.ceil - ROOM.floor;
  const cy = (ROOM.ceil + ROOM.floor) / 2;
  const wallMat = (p: typeof plasterBack) => <meshLambertMaterial color={PAINT} map={p.map} normalMap={p.normalMap} aoMap={ao} />;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM.floor, (ROOM.z0 + ROOM.z1) / 2]}>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial color="#c9b8a4" map={floor.map} normalMap={floor.normalMap} />
      </mesh>
      <mesh position={[0, cy, ROOM.z0]}>
        <planeGeometry args={[w, h]} />
        {wallMat(plasterBack)}
      </mesh>
      <mesh position={[0, cy, ROOM.z1]} rotation-y={Math.PI}>
        <planeGeometry args={[w, h]} />
        {wallMat(plasterBack)}
      </mesh>
      <mesh position={[ROOM.x0, cy, (ROOM.z0 + ROOM.z1) / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[d, h]} />
        {wallMat(plasterSide)}
      </mesh>
      <mesh position={[ROOM.x1, cy, (ROOM.z0 + ROOM.z1) / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[d, h]} />
        {wallMat(plasterSide)}
      </mesh>
      <mesh position={[0, ROOM.ceil, (ROOM.z0 + ROOM.z1) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#0f1822" roughness={1} />
      </mesh>
      {/* Skirting boards. */}
      <B p={[0, ROOM.floor + 1, ROOM.z0 + 0.4]} s={[w, 2, 0.8]} c={TRIM} />
      <B p={[ROOM.x0 + 0.4, ROOM.floor + 1, (ROOM.z0 + ROOM.z1) / 2]} s={[0.8, 2, d]} c={TRIM} />
      <B p={[ROOM.x1 - 0.4, ROOM.floor + 1, (ROOM.z0 + ROOM.z1) / 2]} s={[0.8, 2, d]} c={TRIM} />
    </group>
  );
}

function Bed() {
  const cloth = usePbr('stretch_poplin', 9, 10, true);
  const relief = useMemo(() => duvetMaps(), []);
  const wood = usePbr('dark_wood', 3, 4);
  const woodHead = usePbr('dark_wood', 2.4, 1.2);
  const duvet = useMemo(() => duvetGeometry(44.8, 3, 50, 1.2), []);
  const pillowCloth = usePbr('stretch_poplin', 5, 3, true);
  const pillowA = useMemo(() => pillowGeometry(25, 5.6, 15, 1), []);
  const pillowB = useMemo(() => pillowGeometry(25, 5.6, 15, 2), []);
  const pillowC = useMemo(() => pillowGeometry(22, 5.2, 12, 3), []);
  const legs: V3[] = [
    [-21, -22, -26],
    [21, -22, -26],
    [-21, -22, 34],
    [21, -22, 34],
  ];
  return (
    <group>
      <B p={[0, -15, 4]} s={[46, 6, 66]} c="#9a8372" pbr={wood} />
      {legs.map((p, i) => (
        <B key={i} p={p} s={[3, 8, 3]} c="#9a8372" pbr={wood} />
      ))}
      <B p={[0, -7.5, 4]} s={[44, 9, 64]} c="#dfe3ea" r={0.95} round={1} />
      {/* Duvet with quilting; a pale sheet shows near the pillows. */}
      {/* The duvet fills much of the screen, so its light is baked into the texture and drawn unlit;
          a shadow-only plane over the middle lets the board and props still shade it. */}
      <mesh geometry={duvet} position={[0, -1.52, 9]} receiveShadow>
        <meshLambertMaterial color="#5d6d90" map={cloth.map} normalMap={relief.normal} normalScale={new THREE.Vector2(1.4, 1.4)} aoMap={relief.ao} aoMapIntensity={1.1} />
      </mesh>
      <B p={[0, -1.5, -22.2]} s={[44, 3, 8]} c="#cfd8e6" r={0.95} round={1} recv />
      {/* Pillows: stuffed, creased, in muted linen colours. */}
      <mesh geometry={pillowA} position={[-13, 2.8, -21.5]} rotation={[-0.05, 0.08, 0]} castShadow>
        <meshLambertMaterial color="#d9d4c8" map={pillowCloth.map} normalMap={pillowCloth.normalMap} />
      </mesh>
      <mesh geometry={pillowB} position={[13, 2.8, -21.5]} rotation={[-0.05, -0.08, 0]} castShadow>
        <meshLambertMaterial color="#6c7a93" map={pillowCloth.map} normalMap={pillowCloth.normalMap} />
      </mesh>
      <mesh geometry={pillowC} position={[0, 5.3, -24.4]} rotation={[-0.5, 0, 0]} castShadow>
        <meshLambertMaterial color="#b6ad9c" map={pillowCloth.map} normalMap={pillowCloth.normalMap} />
      </mesh>
      {/* Headboard with an LED strip washing the wall. */}
      <B p={[0, -5, -26.6]} s={[46, 26, 1.8]} c="#9a8372" pbr={woodHead} recv />
      <B p={[0, 8.2, -26.6]} s={[46.6, 0.8, 2.2]} c="#a8907c" pbr={wood} />
      <B p={[-11.5, 9.1, -27.4]} s={[23, 0.45, 0.2]} glow={[0.3, 2.6, 3.2]} />
      <B p={[11.5, 9.1, -27.4]} s={[23, 0.45, 0.2]} glow={[3.2, 0.5, 1.8]} />
      <mesh position={[-11.5, 11, -27.85]}>
        <planeGeometry args={[26, 11]} />
        <meshBasicMaterial map={radialGlowTexture()} color={[0.1, 0.55, 0.7]} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[11.5, 11, -27.85]}>
        <planeGeometry args={[26, 11]} />
        <meshBasicMaterial map={radialGlowTexture()} color={[0.7, 0.12, 0.35]} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Posters() {
  const list = useMemo(
    () =>
      (['sunset', 'planet', 'invader', 'waves'] as const).map((k, i) => ({
        k,
        x: -23 + i * 15.5,
        y: 18 + (i % 2) * 1.5,
        tilt: (i % 2 ? 1 : -1) * 0.02,
        tex: posterTexture(k),
      })),
    [],
  );
  return (
    <group>
      {list.map((p) => (
        <group key={p.k} position={[p.x, p.y, ROOM.z0 + 0.15]} rotation={[0, 0, p.tilt]}>
          <B p={[0, 0, -0.02]} s={[12.6, 17.2, 0.2]} c="#101418" />
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[12, 16.5]} />
            <meshStandardMaterial map={p.tex} roughness={0.7} emissive="#ffffff" emissiveMap={p.tex} emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FairyLights() {
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const photos = useRef<THREE.InstancedMesh>(null);
  const { lights, cards } = useMemo(() => {
    const lights: Placement[] = [];
    const cards: Placement[] = [];
    const swags = 3;
    const span = 25;
    for (let s = 0; s < swags; s++) {
      const x0 = -37.5 + s * span;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = x0 + t * span;
        const y = 25.5 - Math.sin(Math.PI * t) * 3.2;
        lights.push(place(x, y, ROOM.z0 + 0.5, 0.4, 0.4, 0.4));
        if (i % 3 === 1) cards.push({ ...place(x, y - 2.3, ROOM.z0 + 0.4, 3.2, 3.8, 0.1), rotX: 0 });
      }
    }
    return { lights, cards };
  }, []);
  useInstances(bulbs, lights);
  useInstances(photos, cards);
  useLayoutEffect(() => {
    const warm = [new THREE.Color('#ffd9a0'), new THREE.Color('#ffb870'), new THREE.Color('#ffe9c2')];
    lights.forEach((_, i) => bulbs.current?.setColorAt(i, warm[i % 3]!));
    const pal = ['#d9cdb8', '#9fb4c4', '#cba88a', '#e4e0d6', '#a7b79a'].map((c) => new THREE.Color(c));
    cards.forEach((_, i) => photos.current?.setColorAt(i, pal[(i * 3) % pal.length]!));
    if (bulbs.current?.instanceColor) bulbs.current.instanceColor.needsUpdate = true;
    if (photos.current?.instanceColor) photos.current.instanceColor.needsUpdate = true;
  }, [lights, cards]);
  return (
    <group>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lights.length]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={[3, 2.6, 2]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={photos} args={[undefined, undefined, cards.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.6} envMapIntensity={0.3} />
      </instancedMesh>
    </group>
  );
}

function NeonBolt() {
  const geo = useMemo(() => {
    const pts: [number, number][] = [
      [1, 6],
      [-3, 0.5],
      [-0.3, 0.5],
      [-2, -6],
      [3.2, 1.3],
      [0.6, 1.3],
      [3, 6],
    ];
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x * 0.9, y * 0.9) : s.moveTo(x * 0.9, y * 0.9)));
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false });
  }, []);
  return (
    <group position={[33, 10, ROOM.z0 + 0.3]}>
      <mesh geometry={geo}>
        <meshBasicMaterial color={[0.4, 2.6, 3.2]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <planeGeometry args={[16, 16]} />
        <meshBasicMaterial map={radialGlowTexture()} color={[0.1, 0.5, 0.65]} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Shelf() {
  const vase = useMemo(() => vaseGeometry(), []);
  const books = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => {
    const out: Placement[] = [];
    let x = -6.4;
    const heights = [5.2, 6.4, 4.8, 6, 5.5, 4.4, 6.2];
    heights.forEach((h, i) => {
      const w = 0.9 + (i % 3) * 0.3;
      out.push(place(x + w / 2, 0.4 + h / 2, 0, w, h, 2.8));
      x += w + 0.08;
    });
    return out;
  }, []);
  useInstances(books, list);
  useLayoutEffect(() => {
    const pal = ['#8a4b3a', '#37575a', '#b99a55', '#4d4a63', '#7a4a52', '#3b4f66', '#cfc7b4'].map((c) => new THREE.Color(c));
    list.forEach((_, i) => books.current?.setColorAt(i, pal[i % pal.length]!));
    if (books.current?.instanceColor) books.current.instanceColor.needsUpdate = true;
  }, [list]);
  return (
    <group position={[-30, 9, ROOM.z0 + 2.2]}>
      <B p={[0, 0, 0]} s={[17, 0.8, 3.6]} c={WOOD} r={0.7} />
      <instancedMesh ref={books} args={[undefined, undefined, list.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.8} envMapIntensity={0.3} />
      </instancedMesh>
      <mesh geometry={vase} position={[5.6, 0.4, 0]}>
        <meshStandardMaterial color="#d8d0c2" roughness={0.45} envMapIntensity={0.4} />
      </mesh>
      {[-0.5, 0.1, 0.6].map((dx, i) => (
        <Cy key={i} p={[5.6 + dx, 8.2 + i * 0.5, 0]} r={0.05} h={6 + i} c="#8a7350" rot={[0, 0, dx * 0.25]} seg={5} />
      ))}
    </group>
  );
}

function Window() {
  const sky = useMemo(() => nightSkyTexture(), []);
  const drape = useMemo(() => curtainGeometry(6.6, 31, 4), []);
  const linen = usePbr('rough_linen', 2, 4, true);
  const x = ROOM.x0 + 0.1;
  return (
    <group>
      <mesh position={[x, 8, -2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[22, 26]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {/* Frame, mullions and curtains. */}
      <B p={[x + 0.4, 8, -2]} s={[0.8, 0.9, 23.6]} c={TRIM} />
      <B p={[x + 0.4, 21.2, -2]} s={[0.8, 0.9, 23.6]} c={TRIM} />
      <B p={[x + 0.4, -5.2, -2]} s={[1.6, 0.9, 24]} c={TRIM} />
      <B p={[x + 0.4, 8, -13.4]} s={[0.8, 26.4, 0.9]} c={TRIM} />
      <B p={[x + 0.4, 8, 9.4]} s={[0.8, 26.4, 0.9]} c={TRIM} />
      <B p={[x + 0.4, 8, -2]} s={[0.6, 26, 0.5]} c={TRIM} />
      <B p={[x + 0.4, 8, -2]} s={[0.6, 0.5, 22]} c={TRIM} />
      <mesh geometry={drape} position={[x + 1.8, 9, -15.6]} rotation-y={Math.PI / 2}>
        <meshLambertMaterial color="#7a6a73" map={linen.map} normalMap={linen.normalMap} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={drape} position={[x + 1.8, 9, 11.6]} rotation-y={Math.PI / 2}>
        <meshLambertMaterial color="#7a6a73" map={linen.map} normalMap={linen.normalMap} side={THREE.DoubleSide} />
      </mesh>
      <B p={[x + 1.6, 24.8, -2]} s={[0.6, 0.6, 34]} c="#2a2f3a" m={0.8} />
    </group>
  );
}

function Desk() {
  const screen = useMemo(() => screenTexture(), []);
  const top = 11;
  return (
    <group>
      <B p={[34, top, -8]} s={[12, 1.2, 30]} c="#2a2f3a" r={0.5} round={0.3} />
      {(
        [
          [28.8, -20],
          [28.8, 4],
          [39, -20],
          [39, 4],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <B key={i} p={[x, (top + ROOM.floor) / 2, z]} s={[1.2, top - ROOM.floor, 1.2]} c="#1a1d24" m={0.6} r={0.4} />
      ))}
      {/* Monitor facing the bed. */}
      <B p={[37.5, 21.8, -8]} s={[1, 17.6, 30.6]} c="#0e1015" r={0.4} round={0.3} />
      <mesh position={[36.95, 21.8, -8]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[29.2, 16.4]} />
        <meshBasicMaterial map={screen} toneMapped={false} color={[1.5, 1.5, 1.5]} />
      </mesh>
      <B p={[37.8, 15, -8]} s={[1, 7, 3]} c="#14161c" m={0.5} r={0.4} />
      <B p={[36, 11.8, -8]} s={[8, 0.5, 10]} c="#14161c" m={0.5} r={0.4} />
      {/* Keyboard with a lit edge, mouse and mug. */}
      <B p={[31.5, 11.9, -8]} s={[6.4, 0.7, 19]} c="#14161c" r={0.5} round={0.3} />
      <B p={[29.3, 12.3, -8]} s={[0.25, 0.1, 18.4]} glow={[0.4, 2.2, 2.8]} />
      <B p={[31.5, 12.1, 4.4]} s={[2.4, 1, 3.8]} c="#14161c" r={0.4} round={0.45} />
      <Cy p={[32.5, 13.2, -21.5]} r={1.6} h={3.6} c="#d9d6cf" rough={0.35} />
      <Cy p={[32.5, 15.1, -21.5]} r={1.35} h={0.1} c="#2a1810" rough={0.4} />
      {/* Desk lamp with a warm shade. */}
      <Cy p={[36, 11.7, -22.5]} r={1.8} h={0.5} c="#14161c" metal={0.6} />
      <B p={[36, 17, -22.5]} s={[0.35, 10, 0.35]} c="#14161c" m={0.7} r={0.4} />
      <Cy p={[36, 22.5, -22.5]} r={2.8} r2={1.2} h={2.6} glow={[2.4, 1.6, 0.8]} />
    </group>
  );
}

function Nightstand() {
  const y = ROOM.floor;
  return (
    <group>
      <B p={[-27, y + 7, -21.6]} s={[9, 14, 9]} c={WOOD} r={0.65} />
      <B p={[-27, y + 10.5, -17.05]} s={[7.4, 5, 0.3]} c="#523a27" r={0.65} />
      <Cy p={[-27, y + 14.1, -21.6]} r={2} h={0.4} c="#14161c" metal={0.6} />
      <Cy p={[-27, y + 17.3, -21.6]} r={0.4} h={6} c="#14161c" metal={0.6} />
      <Cy p={[-27, y + 21.2, -21.6]} r={3.2} r2={2} h={3.6} glow={[2.6, 1.7, 0.8]} />
    </group>
  );
}

function Skateboard() {
  const tex = useMemo(() => deckTexture(), []);
  return (
    <group position={[-35, ROOM.floor + 8, ROOM.z0 + 2.2]} rotation={[-0.14, 0.1, 0]}>
      <B p={[0, 0, 0]} s={[4.2, 16.4, 0.7]} round={0.35} map={tex} r={0.5} />
      {[-5.6, 5.6].map((y) => (
        <group key={y}>
          <Cy p={[-1.5, y, 1.1]} r={1.1} h={0.9} c="#f2e9d8" rough={0.4} rot={[0, 0, Math.PI / 2]} />
          <Cy p={[1.5, y, 1.1]} r={1.1} h={0.9} c="#f2e9d8" rough={0.4} rot={[0, 0, Math.PI / 2]} />
        </group>
      ))}
    </group>
  );
}

function Rug() {
  const tex = useMemo(() => rugTexture(), []);
  return (
    <mesh position={[-29, ROOM.floor + 0.08, 16]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[17, 48]} />
      <meshStandardMaterial map={tex} roughness={1} envMapIntensity={0.25} />
    </mesh>
  );
}

function FloorStuff() {
  return (
    <group>
      <group position={[-33, ROOM.floor, -14]} rotation={[0, 0.4, 0]}>
        {/* Backpack leaning on the wall. */}
        <B p={[0, 7, 0]} s={[10, 14, 5.4]} c="#2a2f38" r={0.9} round={1.6} />
        <B p={[0, 4.5, 3]} s={[7.6, 5.6, 1.8]} c="#222730" r={0.9} round={0.8} />
        <B p={[0, 11, 3]} s={[6, 0.5, 0.8]} c="#5d6470" r={0.6} m={0.5} />
      </group>
    </group>
  );
}

/** Warm and cool pools of light from the lamps, monitor and window: cheap additive planes and sprites, no real lights. */
function LightPools() {
  const glow = useMemo(() => radialGlowTexture(), []);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;
  return (
    <group>
      {/* Bedside lamp: halo around the shade and a pool on the duvet and wall. */}
      <sprite position={[-27, ROOM.floor + 21.2, -21.6]} scale={[17, 17, 1]}>
        <spriteMaterial map={glow} color={[1.0, 0.62, 0.28]} opacity={0.55} {...additive} />
      </sprite>
      <mesh position={[-17, 0.07, -8]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial map={glow} color={[0.55, 0.3, 0.1]} opacity={0.5} {...additive} />
      </mesh>
      {/* The headboard LED strips wash the pillows and duvet in cyan and magenta. */}
      <mesh position={[-13, 0.07, -13]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26, 22]} />
        <meshBasicMaterial map={glow} color={[0.05, 0.42, 0.55]} opacity={0.6} {...additive} />
      </mesh>
      <mesh position={[13, 0.07, -13]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26, 22]} />
        <meshBasicMaterial map={glow} color={[0.6, 0.1, 0.3]} opacity={0.6} {...additive} />
      </mesh>
      {/* Desk lamp halo and the monitor's cool spill across the right edge of the bed. */}
      <sprite position={[36, 22.5, -22.5]} scale={[15, 15, 1]}>
        <spriteMaterial map={glow} color={[1.0, 0.66, 0.34]} opacity={0.5} {...additive} />
      </sprite>
      <mesh position={[19, 0.07, -8]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[24, 34]} />
        <meshBasicMaterial map={glow} color={[0.1, 0.22, 0.36]} opacity={0.45} {...additive} />
      </mesh>
      {/* Moonlight from the window falling across the floor and the bed's left side. */}
      <mesh position={[-26, ROOM.floor + 0.1, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[22, 34]} />
        <meshBasicMaterial map={glow} color={[0.12, 0.2, 0.36]} opacity={0.5} {...additive} />
      </mesh>
    </group>
  );
}

/** A teenager's bedroom, seen at night. All of it is static: matrices are frozen after the first frame. */
export default function Room() {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.matrixWorldNeedsUpdate = false;
    });
  }, []);
  return (
    <group ref={group}>
      <Shell />
      <Bed />
      <BedProps />
      <Posters />
      <FairyLights />
      <NeonBolt />
      <Shelf />
      <Window />
      <Desk />
      <Nightstand />
      <Skateboard />
      <Rug />
      <FloorStuff />
      <LightPools />
    </group>
  );
}
