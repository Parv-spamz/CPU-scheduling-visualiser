// Public engine API. Wave 0: STUB implementations backed by the sample result.
// WP-A replaces every STUB below with the real engine (see PLAN.md §5 WP-A).
import sample from '../data/sample-result.json';
import type {
  AlgorithmId,
  CompareOutcome,
  Process,
  RunResult,
  Settings,
  SimulateOutcome,
  ValidationResult,
} from './types';
import { ALGORITHMS } from './types';

const SAMPLE = sample as RunResult;

export interface Preset {
  id: string;
  label: string;
  description: string;
  processes: Process[];
}

// STUB: replaced by src/engine/presets.ts
export const presets: Preset[] = [
  {
    id: 'rrSample',
    label: 'Sample (RR q=2)',
    description: 'Three jobs arriving one tick apart.',
    processes: SAMPLE.processes,
  },
];

// STUB: replaced by src/engine/validate.ts
export function validateWorkload(processes: Process[], _settings: Settings): ValidationResult {
  return processes.length === 0
    ? { ok: false, errors: [{ field: 'workload', pid: null, message: 'Add at least one process.' }] }
    : { ok: true };
}

// STUB: replaced by src/engine/simulate.ts
export function simulate(processes: Process[], settings: Settings): SimulateOutcome {
  const v = validateWorkload(processes, settings);
  if (!v.ok) return v;
  return { ok: true, result: { ...SAMPLE, algorithm: settings.algorithm, settings } };
}

// STUB: replaced by src/engine/compare.ts
export function compareAll(processes: Process[], settings: Settings): CompareOutcome {
  const v = validateWorkload(processes, settings);
  if (!v.ok) return v;
  const runs = {} as Record<AlgorithmId, RunResult>;
  for (const a of ALGORITHMS) runs[a] = { ...SAMPLE, algorithm: a, settings: { ...settings, algorithm: a } };
  return { ok: true, result: { runs, winner: 'rr', runnerUp: 'fcfs', reason: 'Stub result.' } };
}

// STUB: replaced by src/engine/random.ts
export function randomWorkload(_seed: number, _size: number): Process[] {
  return SAMPLE.processes;
}
