import { CLOCK_READOUT as R } from './layout';

const half = R.width / 2;
const pad = R.height * 0.18;

/** Clock and context-switch readout near the CPU. Values come from the store playhead (event boundaries only). */
export default function Readouts({ clock, contextSwitches }: { clock: number; contextSwitches: number }) {
  const cells = [
    { label: 'CLOCK', value: `t ${String(clock).padStart(2, '0')}` },
    { label: 'CTX SW', value: String(contextSwitches).padStart(2, '0') },
  ];
  return (
    <g pointerEvents="none">
      <rect x={R.x} y={R.y} width={R.width} height={R.height} rx={pad / 2} className="readout" />
      <line x1={R.x + half} y1={R.y + pad} x2={R.x + half} y2={R.y + R.height - pad} className="silk-line" />
      {cells.map((c, i) => {
        const x = R.x + half * i + pad;
        return (
          <g key={c.label}>
            <text x={x} y={R.y + pad * 1.6} className="readout-label mono">
              {c.label}
            </text>
            <text x={x} y={R.y + R.height - pad} className="readout-value mono">
              {c.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}
