import type { KeyboardEvent } from 'react';
import { ALGORITHM_LABEL } from '../engine/types';
import type { AlgorithmId, RunResult, Settings } from '../engine/types';
import { CACHE_INSET, RESULT_PANEL_SIZE } from './layout';
import type { Point } from './layout';
import { DEF, url } from './Defs';
import { fmt2, ganttBlocks, modeLabel } from './resultsModel';

// Every position below is a fraction of the panel size (layout.ts owns the panel rects).
const W = RESULT_PANEL_SIZE.width;
const H = RESULT_PANEL_SIZE.height;
const PAD = W * 0.04;
const R = CACHE_INSET;

const SOCKET = { x: PAD, y: H * 0.13, size: H * 0.5 };
const PIN_BAND = SOCKET.size * 0.1;
const DIE = { x: SOCKET.x + PIN_BAND, y: SOCKET.y + PIN_BAND, size: SOCKET.size - PIN_BAND * 2 };
const MODULE = { x: SOCKET.x + SOCKET.size + W * 0.08, y: SOCKET.y, height: SOCKET.size };
const MODULE_W = W - PAD - MODULE.x;
const CELL_W = MODULE_W / 2;
const CELL_H = MODULE.height / 2;
const CELL_PAD = CELL_W * 0.07;
const GANTT = { x: PAD, y: H * 0.72, width: W - PAD * 2, height: H * 0.17 };
const LANE = { y: GANTT.y + GANTT.height * 0.3, height: GANTT.height * 0.55 };
const BUS_YS = [0.25, 0.5, 0.75].map((f) => SOCKET.y + SOCKET.size * f);
const BADGE = { width: W * 0.17, height: H * 0.075 };

interface Props {
  id: AlgorithmId;
  /** Ref designator on the silkscreen, e.g. U1. */
  designator: string;
  panel: Point;
  run: RunResult | null;
  settings: Settings;
  axis: { t0: number; span: number };
  isWinner: boolean;
  isRunnerUp: boolean;
  interactive: boolean;
  onActivate: (id: AlgorithmId) => void;
  onHover: (id: AlgorithmId | null) => void;
}

/** One algorithm's result drawn as a small CPU package with a readout module and its own Gantt trace. */
export default function MiniCpu({ id, designator, panel, run, settings, axis, isWinner, isRunnerUp, interactive, onActivate, onHover }: Props) {
  const label = ALGORITHM_LABEL[id];
  const colors = new Map(run?.processes.map((p) => [p.pid, p]) ?? []);
  const blocks = run ? ganttBlocks(run.segments, axis.t0, axis.span, GANTT.x, GANTT.width) : [];
  const cells = [
    { label: 'AVG WAIT', value: run ? fmt2(run.averages.waiting) : '--', key: 'wait' },
    { label: 'AVG TURNAROUND', value: run ? fmt2(run.averages.turnaround) : '--', key: 'tat' },
    { label: 'AVG RESPONSE', value: run ? fmt2(run.averages.response) : '--', key: 'resp' },
    { label: 'CTX SWITCHES', value: run ? String(run.contextSwitches) : '--', key: 'ctx' },
  ];
  const aria = run
    ? `${label}${isWinner ? ', winner' : isRunnerUp ? ', runner-up' : ''}: average waiting ${fmt2(run.averages.waiting)}, ` +
      `turnaround ${fmt2(run.averages.turnaround)}, response ${fmt2(run.averages.response)}, ` +
      `${run.contextSwitches} context switches. Activate to replay ${label} on the CPU.`
    : `${label}: no results.`;

  const onKeyDown = (e: KeyboardEvent<SVGGElement>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    onActivate(id);
  };

  const cls = ['mini-cpu', isWinner ? 'mini-cpu--winner' : '', isRunnerUp ? 'mini-cpu--runner' : ''].filter(Boolean).join(' ');

  return (
    <g
      transform={`translate(${panel.x} ${panel.y})`}
      className={cls}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={aria}
      data-algo={id}
      onClick={(e) => {
        e.stopPropagation();
        onActivate(id);
      }}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
    >
      {/* Footprint courtyard: the hit area, drawn as a faint silkscreen outline. */}
      <rect x={0} y={0} width={W} height={H} rx={R * 2} className="mini-courtyard" />
      <rect x={-R / 2} y={-R / 2} width={W + R} height={H + R} rx={R * 2.5} className="mini-focus" />

      <text x={PAD} y={H * 0.075} className="silk mono">
        {designator} · {label.toUpperCase()}
      </text>

      {isWinner && (
        <g className="mini-badge">
          <rect
            x={W - PAD - BADGE.width}
            y={H * 0.075 - BADGE.height * 0.72}
            width={BADGE.width}
            height={BADGE.height}
            rx={BADGE.height / 2}
            filter={url(DEF.glow)}
            className="mini-badge-body"
          />
          <text
            x={W - PAD - BADGE.width / 2}
            y={H * 0.075 - BADGE.height * 0.22}
            textAnchor="middle"
            dominantBaseline="central"
            className="mini-badge-text mono"
          >
            ★ WINNER
          </text>
        </g>
      )}
      {isRunnerUp && (
        <text x={W - PAD} y={H * 0.075} textAnchor="end" className="mini-runner mono">
          RUNNER-UP
        </text>
      )}

      {/* Package: socket, pin field, pin-1 marker, die */}
      <rect x={SOCKET.x} y={SOCKET.y} width={SOCKET.size} height={SOCKET.size} rx={R} className="socket mini-socket" />
      <rect
        x={SOCKET.x + PIN_BAND * 0.15}
        y={SOCKET.y + PIN_BAND * 0.15}
        width={SOCKET.size - PIN_BAND * 0.3}
        height={SOCKET.size - PIN_BAND * 0.3}
        rx={R / 2}
        fill={url(DEF.socketPins)}
      />
      <path
        d={`M ${SOCKET.x} ${SOCKET.y + PIN_BAND * 0.8} L ${SOCKET.x} ${SOCKET.y + R} Q ${SOCKET.x} ${SOCKET.y} ${SOCKET.x + R} ${SOCKET.y} L ${SOCKET.x + PIN_BAND * 0.8} ${SOCKET.y} Z`}
        fill="var(--copper)"
        opacity={0.7}
      />
      <rect x={DIE.x} y={DIE.y} width={DIE.size} height={DIE.size} rx={R / 2} className="die" />
      <rect x={DIE.x} y={DIE.y} width={DIE.size} height={DIE.size} rx={R / 2} fill={url(DEF.dieSheen)} />
      <text x={DIE.x + DIE.size / 2} y={DIE.y + DIE.size * 0.42} textAnchor="middle" dominantBaseline="central" className="mini-die-name">
        {label}
      </text>
      <text x={DIE.x + DIE.size / 2} y={DIE.y + DIE.size * 0.62} textAnchor="middle" dominantBaseline="central" className="mini-die-mode mono">
        {modeLabel(id, settings)}
      </text>
      <text x={DIE.x + DIE.size / 2} y={DIE.y + DIE.size * 0.86} textAnchor="middle" dominantBaseline="central" className="silk-dim mono">
        {run ? `util ${Math.round(run.utilisation * 100)}% · span ${run.makespan}` : 'no run'}
      </text>

      {/* Bus traces from the package into the readout module */}
      {BUS_YS.map((y) => (
        <g key={y}>
          <line x1={SOCKET.x + SOCKET.size} y1={y} x2={MODULE.x} y2={y} className="mini-trace" />
          <circle cx={MODULE.x} cy={y} r={R / 2.5} className="via" />
        </g>
      ))}

      {/* Readout module: four cells on one board, same language as the clock readout */}
      <rect x={MODULE.x} y={MODULE.y} width={MODULE_W} height={MODULE.height} rx={R / 2} className="readout" />
      <line x1={MODULE.x + CELL_W} y1={MODULE.y + CELL_PAD} x2={MODULE.x + CELL_W} y2={MODULE.y + MODULE.height - CELL_PAD} className="silk-line" />
      <line x1={MODULE.x + CELL_PAD} y1={MODULE.y + CELL_H} x2={MODULE.x + MODULE_W - CELL_PAD} y2={MODULE.y + CELL_H} className="silk-line" />
      {cells.map((c, i) => {
        const cx = MODULE.x + CELL_W * (i % 2) + CELL_PAD * 1.4;
        const cy = MODULE.y + CELL_H * Math.floor(i / 2);
        return (
          <g key={c.key}>
            <text x={cx} y={cy + CELL_H * 0.3} className="readout-label mono">
              {c.label}
            </text>
            <text
              x={cx}
              y={cy + CELL_H * 0.76}
              className={c.key === 'wait' && isWinner ? 'mini-value mini-value--win mono' : 'mini-value mono'}
            >
              {c.value}
            </text>
          </g>
        );
      })}

      {/* Mini logic-analyser trace */}
      <rect x={GANTT.x} y={GANTT.y} width={GANTT.width} height={GANTT.height} rx={R / 2} className="gantt-frame" />
      <text x={GANTT.x + CELL_PAD} y={GANTT.y + GANTT.height * 0.19} dominantBaseline="central" className="silk-dim mono">
        CH0 · {label.toUpperCase()}
      </text>
      <rect x={GANTT.x} y={LANE.y} width={GANTT.width} height={LANE.height} className="gantt-lane" />
      {blocks.map((b, i) => {
        const p = b.pid === null ? undefined : colors.get(b.pid);
        return (
          <g key={i}>
            <rect
              x={b.x}
              y={LANE.y}
              width={b.width}
              height={LANE.height}
              fill={b.pid === null ? url(DEF.idleHatch) : (p?.color ?? 'var(--neon)')}
              className="gantt-seg mini-seg"
            />
            {p && b.width >= LANE.height * 1.1 && (
              <text x={b.x + b.width / 2} y={LANE.y + LANE.height / 2} textAnchor="middle" dominantBaseline="central" className="mini-seg-name mono">
                {p.name}
              </text>
            )}
          </g>
        );
      })}
      {axis.span > 0 && (
        <g>
          <text x={GANTT.x} y={GANTT.y + GANTT.height + H * 0.045} className="gantt-tick mono">
            {axis.t0}
          </text>
          <text x={GANTT.x + GANTT.width} y={GANTT.y + GANTT.height + H * 0.045} textAnchor="end" className="gantt-tick mono">
            {axis.t0 + axis.span}
          </text>
        </g>
      )}
    </g>
  );
}
