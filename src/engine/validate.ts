// Input validation with readable, typed errors (brief §5.2a, PLAN WP-A task 1). Never throws.
import type { Process, Settings, ValidationError, ValidationResult } from './types';

export const MAX_PROCESSES = 12;

function isWhole(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

function label(p: Process | null | undefined, index: number): string {
  if (p && typeof p.name === 'string' && p.name.trim() !== '') return p.name;
  if (p && isWhole(p.pid)) return `P${p.pid}`;
  return `Process ${index + 1}`;
}

export function validateWorkload(processes: Process[], settings: Settings): ValidationResult {
  const errors: ValidationError[] = [];
  const list: Process[] = Array.isArray(processes) ? processes : [];

  if (list.length === 0) {
    errors.push({ field: 'workload', pid: null, message: 'Add at least one process.' });
  }
  if (list.length > MAX_PROCESSES) {
    errors.push({
      field: 'workload',
      pid: null,
      message: `At most ${MAX_PROCESSES} processes are allowed (got ${list.length}).`,
    });
  }

  const seen = new Set<number>();
  list.forEach((p: Process | null | undefined, i) => {
    const name = label(p, i);
    const pid = p && isWhole(p.pid) ? p.pid : null;
    if (pid === null || pid < 1) {
      errors.push({ field: 'pid', pid, message: `${name}: process id must be a whole number ≥ 1.` });
    } else if (seen.has(pid)) {
      errors.push({ field: 'pid', pid, message: `${name}: process id ${pid} is used more than once.` });
    } else {
      seen.add(pid);
    }
    if (!p || !isWhole(p.arrival) || p.arrival < 0) {
      errors.push({ field: 'arrival', pid, message: `${name}: arrival must be a whole number ≥ 0.` });
    }
    if (!p || !isWhole(p.burst) || p.burst < 1) {
      errors.push({ field: 'burst', pid, message: `${name}: burst must be a whole number ≥ 1.` });
    }
    if (!p || !isWhole(p.priority)) {
      errors.push({ field: 'priority', pid, message: `${name}: priority must be a whole number.` });
    }
  });

  if (!settings || !isWhole(settings.quantum) || settings.quantum < 1) {
    errors.push({ field: 'quantum', pid: null, message: 'Quantum must be a whole number ≥ 1.' });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
