import type { AlgorithmId, Settings } from '../engine/types';
import { CACHE_BLOCKS, CACHE_INSET, DIE, SCHEDULER, SOCKET } from './layout';
import { ID } from './targets';
import { DEF, url } from './Defs';
import Core from './Core';

const ALGO_NAME: Record<AlgorithmId, string> = { fcfs: 'FCFS', sjf: 'SJF', priority: 'PRIORITY', rr: 'ROUND ROBIN' };

function algorithmLabel(s: Settings): string {
  if (s.algorithm === 'sjf' && s.preemptive) return 'SRTF';
  if (s.algorithm === 'priority' && s.preemptive) return 'PRIORITY · PREEMPTIVE';
  if (s.algorithm === 'rr') return `${ALGO_NAME.rr} · q=${s.quantum}`;
  return ALGO_NAME[s.algorithm];
}

const PIN_BAND = (SOCKET.width - DIE.width) / 2; // ring of pins between socket edge and die
const R = CACHE_INSET;

interface Props {
  settings: Settings;
  note: string;
  glowFill: string;
}

/** CPU socket, die, cache blocks, scheduler block and the core. The whole package is the "cpu" click target. */
export default function CpuPackage({ settings, note, glowFill }: Props) {
  return (
    <g data-hit="cpu" className="cpu-hit">
      <g filter={url(DEF.shadow)}>
        <rect x={SOCKET.x} y={SOCKET.y} width={SOCKET.width} height={SOCKET.height} rx={R} className="socket" />
      </g>
      <rect
        x={SOCKET.x + PIN_BAND * 0.15}
        y={SOCKET.y + PIN_BAND * 0.15}
        width={SOCKET.width - PIN_BAND * 0.3}
        height={SOCKET.height - PIN_BAND * 0.3}
        rx={R / 2}
        fill={url(DEF.socketPins)}
        pointerEvents="none"
      />
      {/* Pin-1 marker */}
      <path
        d={`M ${SOCKET.x} ${SOCKET.y + PIN_BAND * 0.6} L ${SOCKET.x} ${SOCKET.y + R} Q ${SOCKET.x} ${SOCKET.y} ${SOCKET.x + R} ${SOCKET.y} L ${SOCKET.x + PIN_BAND * 0.6} ${SOCKET.y} Z`}
        fill="var(--copper)"
        opacity={0.7}
        pointerEvents="none"
      />

      <rect x={DIE.x} y={DIE.y} width={DIE.width} height={DIE.height} rx={R / 2} className="die" />
      <rect x={DIE.x} y={DIE.y} width={DIE.width} height={DIE.height} rx={R / 2} fill={url(DEF.dieSheen)} pointerEvents="none" />

      <g pointerEvents="none">
        {CACHE_BLOCKS.map((c, i) => (
          <g key={i}>
            <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={R / 4} className="cache" />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={c.x} y1={c.y + c.height * f} x2={c.x + c.width} y2={c.y + c.height * f} className="cache-line" />
            ))}
            <g data-lod="name">
              <text x={c.x + c.width / 2} y={c.y + c.height / 2} textAnchor="middle" dominantBaseline="central" className="silk-dim mono">
                L2
              </text>
            </g>
          </g>
        ))}

        {/* Scheduler block */}
        <rect x={SCHEDULER.x} y={SCHEDULER.y} width={SCHEDULER.width} height={SCHEDULER.height} rx={R / 2} className="sched" />
        <rect
          id={ID.schedulerFlash}
          x={SCHEDULER.x}
          y={SCHEDULER.y}
          width={SCHEDULER.width}
          height={SCHEDULER.height}
          rx={R / 2}
          opacity={0}
          className="sched-flash"
        />
        <text
          x={SCHEDULER.x + SCHEDULER.width / 2}
          y={SCHEDULER.y + SCHEDULER.height * 0.38}
          textAnchor="middle"
          dominantBaseline="central"
          className="sched-title mono"
        >
          SCHED · {algorithmLabel(settings)}
        </text>
        <g data-lod="name">
          <text
            x={SCHEDULER.x + SCHEDULER.width / 2}
            y={SCHEDULER.y + SCHEDULER.height * 0.74}
            textAnchor="middle"
            dominantBaseline="central"
            className="sched-note mono"
          >
            {note || 'waiting for first dispatch'}
          </text>
        </g>

        <text x={DIE.x + R} y={DIE.y + DIE.height + PIN_BAND * 0.62} className="silk-dim mono">
          CPU · 1C
        </text>
      </g>

      <Core glowFill={glowFill} />
    </g>
  );
}
