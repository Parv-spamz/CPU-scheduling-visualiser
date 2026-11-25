import type { Process } from '../engine/types';
import { STORAGE, STORAGE_EXIT, STORAGE_GRID, storageCellCenter } from './layout';

const CELL_W = STORAGE.width / STORAGE_GRID.cols;
const CELL_H = STORAGE.height / STORAGE_GRID.rows;
const INSET = CELL_W * 0.08;
const CELL_COUNT = STORAGE_GRID.cols * STORAGE_GRID.rows;
const CONNECTOR = { width: CELL_W * 0.1, height: CELL_H * 0.9 };

/** Storage connector (job pool): drive bay with a 4x3 parking grid. Captions name each parked process. */
export default function Storage({ processes }: { processes: Process[] }) {
  return (
    <g pointerEvents="none">
      <text x={STORAGE.x} y={STORAGE.y - CELL_H * 0.12} className="silk">
        STORAGE · JOB POOL
      </text>
      <rect x={STORAGE.x} y={STORAGE.y} width={STORAGE.width} height={STORAGE.height} rx={INSET} className="bay" />
      {/* Edge connector where chips leave toward the bus */}
      <rect
        x={STORAGE_EXIT.x - CONNECTOR.width / 2}
        y={STORAGE_EXIT.y - CONNECTOR.height / 2}
        width={CONNECTOR.width}
        height={CONNECTOR.height}
        rx={CONNECTOR.width / 3}
        className="bay-connector"
      />
      {Array.from({ length: CELL_COUNT }, (_, i) => {
        const c = storageCellCenter(i);
        return (
          <rect
            key={i}
            x={c.x - CELL_W / 2 + INSET}
            y={c.y - CELL_H / 2 + INSET}
            width={CELL_W - INSET * 2}
            height={CELL_H - INSET * 2}
            rx={INSET / 2}
            className="bay-cell"
          />
        );
      })}
      {processes.map((p, i) => {
        const c = storageCellCenter(i);
        return (
          <text key={p.pid} x={c.x} y={c.y + CELL_H * 0.34} textAnchor="middle" className="silk-dim mono">
            {p.name} · t{p.arrival}
          </text>
        );
      })}
    </g>
  );
}
