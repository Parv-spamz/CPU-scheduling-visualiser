// CSV export of one run (brief §5.5, should-have).
import { ALGORITHM_LABEL } from './types';
import type { RunResult } from './types';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number)[]): string => cells.map(cell).join(',');
const fmt = (n: number): string => n.toFixed(2);

export function toCsv(result: RunResult): string {
  const lines: string[] = [
    row(['algorithm', ALGORITHM_LABEL[result.algorithm]]),
    row(['pid', 'name', 'arrival', 'burst', 'priority', 'completion', 'turnaround', 'waiting', 'response']),
  ];
  for (const r of result.perProcess) {
    const p = result.processes.find((x) => x.pid === r.pid);
    lines.push(
      row([
        r.pid,
        p?.name ?? `P${r.pid}`,
        p?.arrival ?? '',
        p?.burst ?? '',
        p?.priority ?? '',
        r.completion,
        r.turnaround,
        r.waiting,
        r.response,
      ]),
    );
  }
  lines.push(
    row(['average', '', '', '', '', '', fmt(result.averages.turnaround), fmt(result.averages.waiting), fmt(result.averages.response)]),
  );
  lines.push('');
  lines.push(row(['segment', 'pid', 'start', 'end']));
  result.segments.forEach((s, i) => lines.push(row([i, s.pid === null ? 'idle' : s.pid, s.start, s.end])));
  lines.push('');
  lines.push(row(['utilisation', fmt(result.utilisation)]));
  lines.push(row(['throughput', fmt(result.throughput)]));
  lines.push(row(['contextSwitches', result.contextSwitches]));
  lines.push(row(['idleTime', result.idleTime]));
  lines.push(row(['makespan', result.makespan]));
  return lines.join('\n') + '\n';
}
