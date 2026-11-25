import type { Process } from '../engine/types';
import { CHIP_HEIGHT, CHIP_RADIUS, STORAGE_CHIP_SCALE, chipWidth, storageCellCenter } from './layout';
import { ATTR } from './targets';
import { DEF, url } from './Defs';

const H = CHIP_HEIGHT;
const PIN_PITCH = H / 3;
const PIN_LEN = H / 7;
const BADGE_R = H / 4.2;

interface Props {
  process: Process;
  /** Position in the workload; picks the storage parking cell. */
  index: number;
  active: boolean;
  best: boolean;
  remaining: number;
}

/**
 * A process chip, drawn centred on (0,0). Its world position comes from the transform
 * (initially the storage cell at storage scale); the player animates x, y, scale, opacity.
 */
export default function Chip({ process: p, index, active, best, remaining }: Props) {
  const w = chipWidth(p.burst);
  const c = storageCellCenter(index);
  const pins = Math.max(1, Math.floor((w - CHIP_RADIUS * 2) / PIN_PITCH));
  const pinSpan = (pins - 1) * PIN_PITCH;
  const notchX = -w / 2 + CHIP_RADIUS + BADGE_R / 2;
  return (
    <g {...{ [ATTR.chip]: p.pid }} transform={`translate(${c.x} ${c.y}) scale(${STORAGE_CHIP_SCALE})`}>
      {/* DIP-style pins */}
      {Array.from({ length: pins }, (_, i) => {
        const x = -pinSpan / 2 + i * PIN_PITCH;
        return (
          <g key={i}>
            <line x1={x} y1={-H / 2 - PIN_LEN} x2={x} y2={-H / 2} className="chip-pin" />
            <line x1={x} y1={H / 2} x2={x} y2={H / 2 + PIN_LEN} className="chip-pin" />
          </g>
        );
      })}
      <rect
        x={-w / 2}
        y={-H / 2}
        width={w}
        height={H}
        rx={CHIP_RADIUS}
        fill={p.color}
        filter={active ? url(DEF.glow) : undefined}
        className={best ? 'chip-body chip-body-best' : 'chip-body'}
      />
      <circle cx={notchX} cy={0} r={BADGE_R / 2} className="chip-notch" />

      <g {...{ [ATTR.lod]: 'name' }}>
        <text x={notchX + BADGE_R} y={0} dominantBaseline="central" className="chip-name mono">
          {p.name}
        </text>
      </g>

      <g {...{ [ATTR.lod]: 'detail' }}>
        <text x={w / 2 - CHIP_RADIUS} y={0} textAnchor="end" dominantBaseline="central" className="chip-remaining mono">
          {remaining}/{p.burst}
        </text>
        <circle cx={w / 2} cy={-H / 2} r={BADGE_R} className="chip-badge" color={p.color} />
        <text x={w / 2} y={-H / 2} textAnchor="middle" dominantBaseline="central" fill={p.color} className="chip-badge-text mono">
          {p.priority}
        </text>
      </g>

      <rect
        {...{ [ATTR.chipFlash]: p.pid }}
        x={-w / 2}
        y={-H / 2}
        width={w}
        height={H}
        rx={CHIP_RADIUS}
        opacity={0}
        className="chip-flash"
      />
      <g {...{ [ATTR.chipCheck]: p.pid }} opacity={0} pointerEvents="none">
        <circle cx={w / 2} cy={0} r={H / 2.6} className="chip-check-disc" />
        <path
          d={`M ${w / 2 - H / 6} ${0} L ${w / 2 - H / 20} ${H / 8} L ${w / 2 + H / 5} ${-H / 7}`}
          className="chip-check-mark"
        />
      </g>
    </g>
  );
}
