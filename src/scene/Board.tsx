import { BOARD } from './layout';

// WP-B: replace with the full board (power block, socket, die, RAM, storage, traces, chips, Gantt...).
export default function Board() {
  return (
    <rect
      x={BOARD.x}
      y={BOARD.y}
      width={BOARD.width}
      height={BOARD.height}
      rx={BOARD.radius}
      fill="var(--board)"
      stroke="var(--board-edge)"
      strokeWidth={2}
    />
  );
}
