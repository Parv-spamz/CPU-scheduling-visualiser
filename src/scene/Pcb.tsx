import { BOARD, CPU_CENTER, POWER_BLOCK, SOCKET, polylinePoints } from './layout';
import { DEF, url } from './Defs';

const R = BOARD.radius;
const PB = POWER_BLOCK;

/** Mounting holes, inset from the board corners by the corner radius. */
const HOLES = [
  { x: BOARD.x + R, y: BOARD.y + R },
  { x: BOARD.x + BOARD.width - R, y: BOARD.y + R },
  { x: BOARD.x + R, y: BOARD.y + BOARD.height - R },
  { x: BOARD.x + BOARD.width - R, y: BOARD.y + BOARD.height - R },
];

const CAP_COUNT = 4;
const CAP_PITCH = PB.width / CAP_COUNT;
const CAP_R = CAP_PITCH * 0.32;
const CAP_Y = PB.y + PB.height * 0.36;

const CHOKE_COUNT = 3;
const CHOKE = PB.height * 0.26;
const CHOKE_PITCH = (PB.width * 0.62) / CHOKE_COUNT;
const CHOKE_Y = PB.y + PB.height * 0.62;

/** Power rail from the VRM into the left edge of the socket (decoration). */
const RAIL = [
  { x: PB.x + PB.width, y: PB.y + PB.height / 2 },
  { x: SOCKET.x - R, y: PB.y + PB.height / 2 },
  { x: SOCKET.x - R, y: CPU_CENTER.y - SOCKET.height / 4 },
  { x: SOCKET.x, y: CPU_CENTER.y - SOCKET.height / 4 },
];

/** The PCB itself (click target for "board") plus static decoration: holes, VRM, silkscreen. */
export default function Pcb() {
  return (
    <g>
      <g data-hit="board">
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx={R} className="pcb" />
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx={R} fill={url(DEF.pcbGrid)} pointerEvents="none" />
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx={R} fill={url(DEF.pcbShade)} pointerEvents="none" />
      </g>

      <g pointerEvents="none">
        {HOLES.map((h) => (
          <circle key={`${h.x}-${h.y}`} cx={h.x} cy={h.y} r={R / 2.4} className="pcb-hole" />
        ))}

        <polyline points={polylinePoints(RAIL)} className="power-rail" />

        {/* VRM: capacitors + chokes */}
        <rect x={PB.x} y={PB.y} width={PB.width} height={PB.height} rx={R / 4} className="vrm" />
        {Array.from({ length: CAP_COUNT }, (_, i) => {
          const cx = PB.x + CAP_PITCH * (i + 0.5);
          return (
            <g key={`cap-${i}`}>
              <circle cx={cx} cy={CAP_Y} r={CAP_R} className="cap-body" />
              <path
                d={`M ${cx - CAP_R * 0.6} ${CAP_Y} L ${cx + CAP_R * 0.6} ${CAP_Y} M ${cx} ${CAP_Y - CAP_R * 0.6} L ${cx} ${CAP_Y + CAP_R * 0.6}`}
                className="cap-top"
              />
            </g>
          );
        })}
        {Array.from({ length: CHOKE_COUNT }, (_, i) => {
          const x = PB.x + PB.width * 0.06 + CHOKE_PITCH * i;
          return (
            <g key={`choke-${i}`}>
              <rect x={x} y={CHOKE_Y} width={CHOKE} height={CHOKE} rx={CHOKE / 6} className="choke" />
              <circle cx={x + CHOKE / 2} cy={CHOKE_Y + CHOKE / 2} r={CHOKE / 3.2} className="choke-coil" />
            </g>
          );
        })}
        <text x={PB.x + PB.width * 0.94} y={PB.y + PB.height * 0.86} textAnchor="end" className="silk">
          VRM
        </text>
        <text x={PB.x + PB.width * 0.94} y={PB.y + PB.height * 0.86 - R * 0.6} textAnchor="end" className="silk-dim">
          12V IN
        </text>

        {/* Board silkscreen */}
        <text x={BOARD.x + BOARD.width - R * 2} y={BOARD.y + BOARD.height - R * 0.8} textAnchor="end" className="silk">
          SCHED-MB · REV A
        </text>
        <text x={BOARD.x + R * 2} y={BOARD.y + BOARD.height - R * 0.8} className="silk-dim">
          1 CORE · FCFS / SJF / PRIORITY / RR
        </text>
      </g>
    </g>
  );
}
