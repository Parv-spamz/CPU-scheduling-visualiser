import { CPU_OUT_START, STORAGE_EXIT, traceSlotToCpu, type Point } from './layout';
import type { PulseId } from './targets';

/** Pulse dots are drawn at (0,0) and placed by transform, so the player can animate world x/y directly. */
const PULSES: { id: PulseId; at: Point }[] = [
  { id: 'storage-ram', at: STORAGE_EXIT },
  { id: 'ram-cpu', at: traceSlotToCpu(0)[0] },
  { id: 'cpu-out', at: CPU_OUT_START },
];

const PULSE_R = 5;

export default function TracePulses() {
  return (
    <g pointerEvents="none">
      {PULSES.map((p) => (
        <circle
          key={p.id}
          data-trace-pulse={p.id}
          cx={0}
          cy={0}
          r={PULSE_R}
          className="pulse"
          opacity={0}
          transform={`translate(${p.at.x} ${p.at.y})`}
        />
      ))}
    </g>
  );
}
