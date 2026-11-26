import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { CAPACITORS, CHOKE_SIZE, EPS_CONNECTOR, VRM_CHOKES, VRM_HEATSINK_LEFT, VRM_HEATSINK_TOP, type Rect } from '../../scene/layout';
import { at, mm, rectCenter, rectSize, toX, toZ } from '../kit/space';
import { brushedTexture } from '../kit/canvasTexture';
import { useInstances, type Placement } from '../kit/instances';

/** Finned aluminium heat sink: a base block plus thin fins across its short side. */
function Heatsink({ r, height, finsAlongX }: { r: Rect; height: number; finsAlongX: boolean }) {
  const fins = useRef<THREE.InstancedMesh>(null);
  const brushed = useMemo(() => brushedTexture(), []);
  const size = rectSize(r);
  const c = rectCenter(r);
  const base = mm(5);
  const pitch = mm(2.3);
  const list = useMemo(() => {
    const out: Placement[] = [];
    const span = finsAlongX ? size.w : size.d;
    const n = Math.floor(span / pitch);
    for (let i = 0; i < n; i++) {
      const o = -span / 2 + pitch * (i + 0.5);
      out.push({
        pos: new THREE.Vector3(c[0] + (finsAlongX ? o : 0), base + (height - base) / 2, c[2] + (finsAlongX ? 0 : o)),
        scale: new THREE.Vector3(finsAlongX ? mm(0.9) : size.w * 0.96, height - base, finsAlongX ? size.d * 0.96 : mm(0.9)),
      });
    }
    return out;
  }, [c, size.w, size.d, height, base, pitch, finsAlongX]);
  useInstances(fins, list);
  return (
    <group>
      <RoundedBox args={[size.w, base, size.d]} radius={mm(0.8)} smoothness={2} position={[c[0], base / 2, c[2]]} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3e44" metalness={0.85} roughness={0.42} roughnessMap={brushed} />
      </RoundedBox>
      <instancedMesh ref={fins} args={[undefined, undefined, list.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#2c3036" metalness={0.8} roughness={0.38} roughnessMap={brushed} />
      </instancedMesh>
      {/* Polished cap strip along the top edge, like the machined accent on retail boards. */}
      <mesh position={[c[0], height + mm(0.6), c[2]]} castShadow>
        <boxGeometry args={[finsAlongX ? size.w : mm(3), mm(1.2), finsAlongX ? mm(3) : size.d]} />
        <meshStandardMaterial color="#b8bcc2" metalness={1} roughness={0.22} roughnessMap={brushed} />
      </mesh>
    </group>
  );
}

/** Nickel-plated heat pipe joining the two VRM heat sinks. */
function HeatPipe() {
  const geo = useMemo(() => {
    const a = at({ x: VRM_HEATSINK_TOP.x + 4, y: VRM_HEATSINK_TOP.y + 8 }, mm(9));
    const b = at({ x: VRM_HEATSINK_LEFT.x + 9, y: VRM_HEATSINK_LEFT.y + 4 }, mm(9));
    const mid = new THREE.Vector3((a[0] + b[0]) / 2 - mm(4), mm(12), (a[2] + b[2]) / 2 - mm(4));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(...a), mid, new THREE.Vector3(...b)]);
    return new THREE.TubeGeometry(curve, 32, mm(3), 16, false);
  }, []);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#cfd2d6" metalness={1} roughness={0.18} />
    </mesh>
  );
}

/** VRM: heat sinks, heat pipe, ferrite chokes, polymer capacitors and the 8-pin CPU power connector. */
export default function PowerDelivery() {
  const chokes = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const capTops = useRef<THREE.InstancedMesh>(null);
  const epsPins = useRef<THREE.InstancedMesh>(null);

  const chokeList = useMemo<Placement[]>(
    () => VRM_CHOKES.map((p) => ({ pos: new THREE.Vector3(toX(p.x), mm(3), toZ(p.y)), scale: new THREE.Vector3(mm(CHOKE_SIZE), mm(6), mm(CHOKE_SIZE)) })),
    [],
  );
  const capList = useMemo<Placement[]>(
    () => CAPACITORS.map(([x, y, d]) => ({ pos: new THREE.Vector3(toX(x), mm(d * 1.3) / 2, toZ(y)), scale: new THREE.Vector3(mm(d), mm(d * 1.3), mm(d)) })),
    [],
  );
  const capTopList = useMemo<Placement[]>(
    () => CAPACITORS.map(([x, y, d]) => ({ pos: new THREE.Vector3(toX(x), mm(d * 1.3) + mm(0.05), toZ(y)), scale: new THREE.Vector3(mm(d * 0.92), mm(0.1), mm(d * 0.92)) })),
    [],
  );
  const epsList = useMemo<Placement[]>(() => {
    const out: Placement[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++)
        out.push({
          pos: new THREE.Vector3(toX(EPS_CONNECTOR.x + 2.4 + i * 4.2), mm(12.05), toZ(EPS_CONNECTOR.y + 2.6 + j * 4.4)),
          scale: new THREE.Vector3(mm(3.2), mm(0.2), mm(3.2)),
        });
    return out;
  }, []);
  useInstances(chokes, chokeList);
  useInstances(caps, capList);
  useInstances(capTops, capTopList);
  useInstances(epsPins, epsList);
  const eps = rectSize(EPS_CONNECTOR);

  return (
    <group>
      <Heatsink r={VRM_HEATSINK_TOP} height={mm(22)} finsAlongX />
      <Heatsink r={VRM_HEATSINK_LEFT} height={mm(28)} finsAlongX={false} />
      <HeatPipe />
      <instancedMesh ref={chokes} args={[undefined, undefined, chokeList.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#3d4044" roughness={0.78} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, capList.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
        <meshStandardMaterial color="#c9cdd2" metalness={1} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={capTops} args={[undefined, undefined, capTopList.length]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
        <meshStandardMaterial color="#9a9ea4" metalness={1} roughness={0.5} />
      </instancedMesh>
      <mesh position={rectCenter(EPS_CONNECTOR, mm(6))} castShadow receiveShadow>
        <boxGeometry args={[eps.w, mm(12), eps.d]} />
        <meshStandardMaterial color="#111213" roughness={0.6} />
      </mesh>
      <instancedMesh ref={epsPins} args={[undefined, undefined, epsList.length]}>
        <boxGeometry />
        <meshBasicMaterial color="#020202" />
      </instancedMesh>
    </group>
  );
}
