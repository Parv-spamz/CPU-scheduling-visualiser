import { CHIP_HEIGHT, RAM_SLOT, WORLD } from './layout';

/** Shared SVG defs. Ids are prefixed `mb-` to avoid collisions with other layers. */
export const DEF = {
  glow: 'mb-glow',
  pcbGrid: 'mb-pcb-grid',
  pcbShade: 'mb-pcb-shade',
  socketPins: 'mb-socket-pins',
  dieSheen: 'mb-die-sheen',
  idleHatch: 'mb-idle-hatch',
  shadow: 'mb-shadow',
} as const;

export const url = (id: string) => `url(#${id})`;

// Pattern pitches are derived from layout sizes so the board texture scales with the world.
const GRID = RAM_SLOT.pitch / 2; // 22 world units
const PIN = CHIP_HEIGHT / 4; // 7 world units
const HATCH = CHIP_HEIGHT / 4;

export default function Defs() {
  return (
    <defs>
      {/* Soft neon glow: used only on the core glow rect and the running chip. */}
      <filter id={DEF.glow} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={PIN} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Cheap drop shadow for the large static components (rendered once, never animated). */}
      <filter id={DEF.shadow} x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy={PIN / 2} stdDeviation={PIN / 2} floodColor="#000" floodOpacity="0.55" />
      </filter>

      <pattern id={DEF.pcbGrid} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
        <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} className="pcb-grid-line" />
        <circle cx={0} cy={0} r={GRID / 18} className="pcb-grid-dot" />
      </pattern>

      <radialGradient
        id={DEF.pcbShade}
        cx={WORLD.width / 2}
        cy={WORLD.height / 2}
        r={WORLD.width * 0.6}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.45" />
      </radialGradient>

      <pattern id={DEF.socketPins} width={PIN} height={PIN} patternUnits="userSpaceOnUse">
        <circle cx={PIN / 2} cy={PIN / 2} r={PIN / 5} className="socket-pin" />
      </pattern>

      <linearGradient id={DEF.dieSheen} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.09" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.25" />
      </linearGradient>

      <pattern id={DEF.idleHatch} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={HATCH} className="gantt-idle-hatch" />
      </pattern>
    </defs>
  );
}
