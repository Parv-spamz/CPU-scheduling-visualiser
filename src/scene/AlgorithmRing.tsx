import type { KeyboardEvent } from 'react';
import { ALGORITHM_LABEL, ALGORITHMS } from '../engine/types';
import type { AlgorithmId } from '../engine/types';
import { useApp } from '../store/useApp';
import { ALGO_BUTTON, ALGO_RING, CACHE_INSET, SOCKET } from './layout';
import { algorithmExplanation, ringLabel } from './resultsModel';
import './results.css';

const BW = ALGO_BUTTON.width;
const BH = ALGO_BUTTON.height;
const R = CACHE_INSET;

/** Four algorithm selector buttons on the socket edge (L1). Selected one glows; labels fade in by LOD. */
export default function AlgorithmRing() {
  const settings = useApp((s) => s.settings);
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  const setTooltip = useApp((s) => s.setTooltip);
  const level = useApp((s) => s.level);

  const select = (id: AlgorithmId): void => {
    if (id !== useApp.getState().settings.algorithm) setAlgorithm(id);
  };

  return (
    <g className="algo-ring" aria-hidden={level === 'L3'}>
      {ALGORITHMS.map((id, i) => {
        const c = ALGO_RING[i];
        const selected = settings.algorithm === id;
        const onKeyDown = (e: KeyboardEvent<SVGGElement>): void => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          select(id);
        };
        return (
          <g
            key={id}
            className={selected ? 'algo-btn algo-btn--on' : 'algo-btn'}
            role="button"
            tabIndex={level === 'L3' ? -1 : 0}
            aria-pressed={selected}
            aria-label={`${ALGORITHM_LABEL[id]} (${ringLabel(id, settings)})`}
            data-algo={id}
            onClick={(e) => {
              e.stopPropagation();
              select(id);
            }}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setTooltip(algorithmExplanation(id, settings))}
            onMouseLeave={() => setTooltip('')}
            onFocus={() => setTooltip(algorithmExplanation(id, settings))}
            onBlur={() => setTooltip('')}
          >
            {/* Contact leg into the socket edge */}
            <line x1={c.x} y1={c.y + BH / 2} x2={c.x} y2={SOCKET.y} className="algo-leg" />
            <rect x={c.x - BW / 2} y={c.y - BH / 2} width={BW} height={BH} rx={R} className="algo-body" />
            <circle cx={c.x - BW / 2 + R * 1.25} cy={c.y} r={R / 3} className="algo-led" />
            <g data-lod="name">
              <text x={c.x + R / 2} y={c.y} textAnchor="middle" dominantBaseline="central" className="algo-text mono">
                {ringLabel(id, settings)}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
