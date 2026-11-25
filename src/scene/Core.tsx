import { CORE, CORE_PROGRESS_RADIUS, CPU_CENTER, QUANTUM_RING_RADIUS, RING_STROKE } from './layout';
import { ID } from './targets';
import { DEF, url } from './Defs';

const GRID_LINES = 5;
const PITCH = CORE.width / (GRID_LINES + 1);
const RING_ROTATE = `rotate(-90 ${CPU_CENTER.x} ${CPU_CENTER.y})`;

/**
 * The single core. Player hooks (glow, flash, idle, rings) start invisible / empty.
 * Rings use pathLength=1 so strokeDashoffset runs 0 (full) .. 1 (empty).
 */
export default function Core({ glowFill }: { glowFill: string }) {
  return (
    <g data-hit="core" className="cpu-hit">
      <rect x={CORE.x} y={CORE.y} width={CORE.width} height={CORE.height} rx={PITCH / 3} className="core" />
      <g pointerEvents="none">
        {Array.from({ length: GRID_LINES }, (_, i) => {
          const o = PITCH * (i + 1);
          return (
            <g key={i}>
              <line x1={CORE.x + o} y1={CORE.y} x2={CORE.x + o} y2={CORE.y + CORE.height} className="core-grid" />
              <line x1={CORE.x} y1={CORE.y + o} x2={CORE.x + CORE.width} y2={CORE.y + o} className="core-grid" />
            </g>
          );
        })}
        <g data-lod="name">
          <text x={CORE.x} y={CORE.y - PITCH / 5} className="core-label mono">
            CORE 0
          </text>
        </g>
      </g>

      <rect
        id={ID.coreGlow}
        x={CORE.x}
        y={CORE.y}
        width={CORE.width}
        height={CORE.height}
        rx={PITCH / 3}
        fill={glowFill}
        opacity={0}
        filter={url(DEF.glow)}
        className="core-overlay"
      />
      <rect
        id={ID.coreFlash}
        x={CORE.x}
        y={CORE.y}
        width={CORE.width}
        height={CORE.height}
        rx={PITCH / 3}
        fill="var(--flash)"
        opacity={0}
        className="core-overlay"
      />
      <g id={ID.coreIdle} opacity={0} className="core-overlay">
        <text x={CPU_CENTER.x} y={CPU_CENTER.y} textAnchor="middle" dominantBaseline="central" className="core-idle-text mono">
          IDLE
        </text>
      </g>

      <g data-lod="detail" className="core-overlay">
        <circle cx={CPU_CENTER.x} cy={CPU_CENTER.y} r={QUANTUM_RING_RADIUS} strokeWidth={RING_STROKE} className="ring-track" />
        <circle cx={CPU_CENTER.x} cy={CPU_CENTER.y} r={CORE_PROGRESS_RADIUS} strokeWidth={RING_STROKE} className="ring-track" />
        <circle
          id={ID.quantumRing}
          cx={CPU_CENTER.x}
          cy={CPU_CENTER.y}
          r={QUANTUM_RING_RADIUS}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          strokeWidth={RING_STROKE}
          transform={RING_ROTATE}
          className="ring-quantum"
        />
        <circle
          id={ID.coreProgress}
          cx={CPU_CENTER.x}
          cy={CPU_CENTER.y}
          r={CORE_PROGRESS_RADIUS}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          strokeWidth={RING_STROKE}
          transform={RING_ROTATE}
          className="ring-progress"
        />
      </g>
    </g>
  );
}
