import {
  BUS_X,
  CPU_CENTER,
  RAM_SLOT_COUNT,
  SOCKET_ENTRY,
  STORAGE_EXIT,
  TRACE_CPU_OUT,
  polylinePoints,
  ramSlotCenter,
  traceSlotToCpu,
  traceStorageToSlot,
  type Point,
} from './layout';

const SLOTS = Array.from({ length: RAM_SLOT_COUNT }, (_, i) => i);

/** Every copper path, as polylines from the layout waypoint helpers. */
const PATHS: Point[][] = [
  ...SLOTS.map((i) => traceStorageToSlot(i)),
  ...SLOTS.map((i) => traceSlotToCpu(i)),
  TRACE_CPU_OUT,
];

/** Vias at every junction and endpoint. */
const VIAS: Point[] = [
  STORAGE_EXIT,
  { x: BUS_X, y: STORAGE_EXIT.y },
  { x: BUS_X, y: CPU_CENTER.y },
  SOCKET_ENTRY,
  ...TRACE_CPU_OUT,
  ...SLOTS.map((i) => ({ x: BUS_X, y: ramSlotCenter(i).y })),
];

const VIA_R = 4;

/** Copper bus traces (static). The moving light pulses live in TracePulses. */
export default function Traces() {
  return (
    <g pointerEvents="none">
      {PATHS.map((pts, i) => (
        <polyline key={`t-${i}`} points={polylinePoints(pts)} className="trace" />
      ))}
      <g className="trace-breathe">
        {PATHS.map((pts, i) => (
          <polyline key={`h-${i}`} points={polylinePoints(pts)} className="trace-hi" />
        ))}
      </g>
      {VIAS.map((v) => (
        <circle key={`v-${v.x}-${v.y}`} cx={v.x} cy={v.y} r={VIA_R} className="via" />
      ))}
    </g>
  );
}
