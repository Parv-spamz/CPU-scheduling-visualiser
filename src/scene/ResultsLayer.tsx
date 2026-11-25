import { useCallback } from 'react';
import { ALGORITHM_LABEL, ALGORITHMS } from '../engine/types';
import type { AlgorithmId } from '../engine/types';
import { useApp } from '../store/useApp';
import { BOARD, RESULT_PANELS, RESULT_PANEL_SIZE, CACHE_INSET } from './layout';
import MiniCpu from './MiniCpu';
import { algorithmExplanation, fmt2, sharedTimeAxis } from './resultsModel';
import './results.css';

// The verdict strip runs across the board in the gap between the two panel rows.
const LEFT = RESULT_PANELS[0];
const RIGHT = RESULT_PANELS[1];
const LOWER = RESULT_PANELS[2];
const ROW_GAP_TOP = LEFT.y + RESULT_PANEL_SIZE.height;
const ROW_GAP = LOWER.y - ROW_GAP_TOP;
const STRIP = {
  x: LEFT.x,
  y: ROW_GAP_TOP + ROW_GAP * 0.15,
  width: RIGHT.x + RESULT_PANEL_SIZE.width - LEFT.x,
  height: ROW_GAP * 0.7,
};
const R = CACHE_INSET;

/**
 * L3 results: four mini-CPUs (one per algorithm) over a dimmed board, a winner badge and a verdict line.
 * Always mounted; visibility is a CSS opacity fade so the camera tween never mounts or unmounts it.
 */
export default function ResultsLayer() {
  const level = useApp((s) => s.level);
  const compare = useApp((s) => s.compare);
  const storeSettings = useApp((s) => s.settings);
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  const setLevel = useApp((s) => s.setLevel);
  const play = useApp((s) => s.play);
  const setTooltip = useApp((s) => s.setTooltip);

  const visible = level === 'L3';
  const runs = compare ? ALGORITHMS.map((id) => compare.runs[id]) : [];
  const axis = sharedTimeAxis(runs);

  const onActivate = useCallback(
    (id: AlgorithmId) => {
      if (useApp.getState().level !== 'L3') return;
      setTooltip('');
      setAlgorithm(id);
      setLevel('L1');
      play();
    },
    [setAlgorithm, setLevel, play, setTooltip],
  );

  const onHover = useCallback(
    (id: AlgorithmId | null) => {
      if (id === null) {
        setTooltip('');
        return;
      }
      const s = compare?.runs[id]?.settings ?? storeSettings;
      setTooltip(`${algorithmExplanation(id, s)} Click to replay it on the CPU.`);
    },
    [compare, storeSettings, setTooltip],
  );

  const reason = compare?.reason ?? 'No comparison yet: load a valid workload in the drawer.';

  return (
    <>
      <g className="results-layer" data-visible={visible} aria-hidden={!visible}>
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx={BOARD.radius} className="results-dim" />

        {ALGORITHMS.map((id, i) => (
          <MiniCpu
            key={id}
            id={id}
            designator={`U${i + 1}`}
            panel={RESULT_PANELS[i]}
            run={compare?.runs[id] ?? null}
            settings={compare?.runs[id]?.settings ?? storeSettings}
            axis={axis}
            isWinner={compare?.winner === id}
            isRunnerUp={compare?.runnerUp === id}
            interactive={visible && compare !== null}
            onActivate={onActivate}
            onHover={onHover}
          />
        ))}

        <g className="results-verdict" pointerEvents="none">
          <rect x={STRIP.x} y={STRIP.y} width={STRIP.width} height={STRIP.height} rx={R} className="verdict-strip" />
          <text x={STRIP.x + R * 2} y={STRIP.y + STRIP.height / 2} dominantBaseline="central" className="verdict-tag mono">
            VERDICT ›
          </text>
          <text
            x={STRIP.x + STRIP.width / 2}
            y={STRIP.y + STRIP.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="verdict-text"
          >
            {reason}
          </text>
        </g>
      </g>

      {/* Screen-reader copy of the comparison; visually hidden so the scene stays dashboard-free. */}
      <foreignObject x={BOARD.x} y={BOARD.y} width={1} height={1} className="results-sr">
        <table className="results-sr-only">
          <caption>Scheduling comparison: {reason}</caption>
          <thead>
            <tr>
              <th scope="col">Algorithm</th>
              <th scope="col">Average waiting</th>
              <th scope="col">Average turnaround</th>
              <th scope="col">Average response</th>
              <th scope="col">Context switches</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {compare
              ? ALGORITHMS.map((id) => {
                  const r = compare.runs[id];
                  return (
                    <tr key={id}>
                      <th scope="row">{ALGORITHM_LABEL[id]}</th>
                      <td>{fmt2(r.averages.waiting)}</td>
                      <td>{fmt2(r.averages.turnaround)}</td>
                      <td>{fmt2(r.averages.response)}</td>
                      <td>{r.contextSwitches}</td>
                      <td>{compare.winner === id ? 'winner' : compare.runnerUp === id ? 'runner-up' : ''}</td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </foreignObject>
    </>
  );
}
