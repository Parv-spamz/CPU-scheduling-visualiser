// The 12 process colours (brief §10). Defined once; index by pid.
export const PROCESS_PALETTE: readonly string[] = [
  '#38e8ff', // cyan
  '#ff5fa2', // pink
  '#ffd23f', // amber
  '#7cff6b', // lime
  '#b18cff', // violet
  '#ff8a3d', // orange
  '#3dffc5', // mint
  '#ff5555', // red
  '#5f9bff', // blue
  '#f2f27a', // pale yellow
  '#ff9de2', // rose
  '#9dfcff', // ice
];

export function colorForPid(pid: number): string {
  const n = PROCESS_PALETTE.length;
  return PROCESS_PALETTE[(((pid - 1) % n) + n) % n];
}
