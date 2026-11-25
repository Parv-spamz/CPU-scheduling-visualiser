import { OUTPUT_PORT, OUTPUT_PORT_CENTER } from './layout';

const H = OUTPUT_PORT.height;
const CHEVRON = H * 0.18;

/** Output port: finished chips leave the board upward through here. */
export default function OutputPort() {
  const { x: cx, y: cy } = OUTPUT_PORT_CENTER;
  const arrowX = OUTPUT_PORT.x + OUTPUT_PORT.width * 0.2;
  return (
    <g pointerEvents="none">
      <rect x={OUTPUT_PORT.x} y={OUTPUT_PORT.y} width={OUTPUT_PORT.width} height={H} rx={H / 5} className="port" />
      {[-1, 1].map((side) => {
        const ax = side < 0 ? arrowX : OUTPUT_PORT.x + OUTPUT_PORT.width - (arrowX - OUTPUT_PORT.x);
        return (
          <path
            key={side}
            d={`M ${ax - CHEVRON} ${cy + CHEVRON / 2} L ${ax} ${cy - CHEVRON / 2} L ${ax + CHEVRON} ${cy + CHEVRON / 2}`}
            className="port-arrow"
          />
        );
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="silk mono">
        OUT
      </text>
    </g>
  );
}
