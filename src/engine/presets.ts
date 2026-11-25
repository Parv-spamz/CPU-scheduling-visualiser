// Ready-made workloads (brief §5.5; PLAN WP-A task 6). The store loads presets[0] at startup.
import { colorForPid } from '../theme/palette';
import type { Process } from './types';

export interface Preset {
  id: string;
  label: string;
  description: string;
  processes: Process[];
}

/** [arrival, burst, priority] per process; pids and names are assigned 1..n in order. */
type Row = [number, number, number];

function build(rows: Row[]): Process[] {
  return rows.map(([arrival, burst, priority], i) => ({
    pid: i + 1,
    name: `P${i + 1}`,
    arrival,
    burst,
    priority,
    color: colorForPid(i + 1),
  }));
}

export const presets: Preset[] = [
  {
    id: 'textbook',
    label: 'Textbook example',
    description: 'Three jobs at t=0 (bursts 6, 2, 4): FCFS waits 4.67 on average, SJF only 2.67.',
    processes: build([
      [0, 6, 2],
      [0, 2, 1],
      [0, 4, 3],
    ]),
  },
  {
    id: 'convoy',
    label: 'Convoy effect',
    description: 'One long job arrives first and, under FCFS, every short job queues behind it.',
    processes: build([
      [0, 20, 3],
      [1, 2, 1],
      [1, 3, 2],
      [2, 1, 1],
      [3, 2, 2],
    ]),
  },
  {
    id: 'starvation',
    label: 'Starvation demo',
    description: 'A long low-priority job (P1) keeps losing to a steady stream of high-priority jobs.',
    processes: build([
      [1, 8, 5],
      [0, 3, 1],
      [2, 3, 1],
      [5, 3, 1],
      [8, 3, 1],
      [11, 3, 1],
    ]),
  },
  {
    id: 'rrSample',
    label: 'Sample (RR q=2)',
    description: 'Three jobs arriving one tick apart: the Round Robin sample with quantum 2.',
    processes: build([
      [0, 5, 1],
      [1, 3, 2],
      [2, 1, 3],
    ]),
  },
];
