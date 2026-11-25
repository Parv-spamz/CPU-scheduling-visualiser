import type { RunResult } from '../engine/types';
import { GANTT, GANTT_LANE, ganttX } from './layout';
import { ATTR, ID } from './targets';
import { DEF, url } from './Defs';

const LANE_Y = GANTT.y + GANTT_LANE.top;
const LANE_BOTTOM = LANE_Y + GANTT_LANE.height;
const PAD = GANTT_LANE.top / 2;

/** Pick a tick step from {1,2,5,10,...} so the axis carries at most ~20 labels. */
function tickStep(makespan: number): number {
  const steps = [1, 2, 5];
  for (let mag = 1; ; mag *= 10) {
    for (const s of steps) if (makespan / (s * mag) <= 20) return s * mag;
  }
}

interface Props {
  run: RunResult | null;
  setTooltip: (text: string) => void;
}

/**
 * Logic-analyser style Gantt strip. One rect per run segment at its final x with width 0;
 * the player grows `width` with the clock. The cursor line is drawn at x=0 and placed by transform.
 */
export default function GanttStrip({ run, setTooltip }: Props) {
  const segments = run?.segments ?? [];
  const t0 = segments.length > 0 ? segments[0].start : 0;
  const makespan = run?.makespan ?? 0;
  const names = new Map(run?.processes.map((p) => [p.pid, p]) ?? []);
  const step = makespan > 0 ? tickStep(makespan) : 1;
  const ticks = makespan > 0 ? Array.from({ length: Math.floor(makespan / step) + 1 }, (_, i) => t0 + i * step) : [];

  return (
    <g>
      <rect x={GANTT.x} y={GANTT.y} width={GANTT.width} height={GANTT.height} rx={PAD / 2} className="gantt-frame" />
      <text x={GANTT.x + PAD} y={GANTT.y + GANTT_LANE.top * 0.65} className="silk-dim mono">
        CH0 · CPU TIMELINE
      </text>
      <text x={GANTT.x + GANTT.width - PAD} y={GANTT.y + GANTT_LANE.top * 0.65} textAnchor="end" className="silk-dim mono">
        {makespan > 0 ? `makespan ${makespan}` : 'no run'}
      </text>
      <rect x={GANTT.x} y={LANE_Y} width={GANTT.width} height={GANTT_LANE.height} className="gantt-lane" />

      <g pointerEvents="none">
        {ticks.map((t) => {
          const x = ganttX(t, t0, makespan);
          return (
            <g key={t}>
              <line x1={x} y1={LANE_Y} x2={x} y2={LANE_BOTTOM + PAD / 2} className="gantt-grid" />
              <text x={x} y={LANE_BOTTOM + PAD * 1.6} textAnchor="middle" className="gantt-tick mono">
                {t}
              </text>
            </g>
          );
        })}
      </g>

      {segments.map((s, i) => {
        const label = s.pid === null ? 'idle' : (names.get(s.pid)?.name ?? `P${s.pid}`);
        const len = s.end - s.start;
        return (
          <rect
            key={i}
            {...{ [ATTR.ganttSeg]: i }}
            x={ganttX(s.start, t0, makespan)}
            y={LANE_Y}
            width={0}
            height={GANTT_LANE.height}
            fill={s.pid === null ? url(DEF.idleHatch) : (names.get(s.pid)?.color ?? 'var(--neon)')}
            className="gantt-seg"
            onMouseEnter={() => setTooltip(`${label}: ${s.start} → ${s.end} (${len} tick${len === 1 ? '' : 's'})`)}
            onMouseLeave={() => setTooltip('')}
          />
        );
      })}

      <line
        id={ID.ganttCursor}
        x1={0}
        y1={GANTT.y + PAD / 2}
        x2={0}
        y2={GANTT.y + GANTT.height - PAD / 2}
        transform={`translate(${GANTT.x} 0)`}
        className="gantt-cursor"
      />
    </g>
  );
}
