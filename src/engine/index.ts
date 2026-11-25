// Public engine API (brief §5.5). Pure TypeScript: no React, DOM, GSAP or Zustand imports.
export { simulate } from './simulate';
export { compareAll } from './compare';
export { validateWorkload } from './validate';
export { presets } from './presets';
export type { Preset } from './presets';
export { randomWorkload } from './random';
export { toCsv } from './csv';
