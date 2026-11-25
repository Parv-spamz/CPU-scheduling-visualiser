// LOCKED CONTRACT: the one Zustand store (PLAN.md §4.3). Add fields only through the lead.
import { create } from 'zustand';
import { compareAll, presets, randomWorkload, simulate } from '../engine';
import type { AlgorithmId, CompareResult, Process, RunResult, Settings, ValidationError } from '../engine/types';
import type { Level } from '../scene/layout';
import { colorForPid } from '../theme/palette';

export interface Playhead {
  clock: number;
  contextSwitches: number;
  note: string;
  runningPid: number | null;
  queue: number[];
}

export const EMPTY_PLAYHEAD: Playhead = { clock: 0, contextSwitches: 0, note: '', runningPid: null, queue: [] };

export interface AppState {
  workload: Process[];
  settings: Settings;
  run: RunResult | null;
  compare: CompareResult | null;
  errors: ValidationError[];
  level: Level;
  followMode: boolean;
  followCore: boolean;
  playing: boolean;
  speed: number;
  /** Simulation time t (ticks), written by the player at most ~10x per second. */
  progress: number;
  /** Requested seek target; the player consumes it and clears to null. */
  seekTo: number | null;
  playhead: Playhead;
  drawerOpen: boolean;
  selectedPid: number | null;
  tooltip: string;
  reducedMotion: boolean;

  setWorkload: (processes: Process[]) => void;
  updateProcess: (pid: number, patch: Partial<Pick<Process, 'arrival' | 'burst' | 'priority'>>) => void;
  addProcess: () => void;
  removeProcess: (pid: number) => void;
  loadPreset: (id: string) => void;
  randomize: (seed: number, size: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setAlgorithm: (algorithm: AlgorithmId) => void;
  recompute: () => void;
  setLevel: (level: Level, opts?: { manual?: boolean }) => void;
  setFollow: (on: boolean) => void;
  setFollowCore: (on: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  seek: (t: number) => void;
  clearSeek: () => void;
  setProgress: (t: number) => void;
  setPlayhead: (p: Playhead) => void;
  setDrawerOpen: (open: boolean) => void;
  selectPid: (pid: number | null) => void;
  setTooltip: (text: string) => void;
}

const DEFAULT_SETTINGS: Settings = { algorithm: 'fcfs', quantum: 2, preemptive: false, lowerIsHigherPriority: true };

/** Renumber pids 1..n and re-assign stable colours. */
function normalise(processes: Process[]): Process[] {
  return processes.map((p, i) => ({ ...p, pid: i + 1, name: `P${i + 1}`, color: colorForPid(i + 1) }));
}

const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export const useApp = create<AppState>()((set, get) => ({
  workload: normalise(presets[0]?.processes ?? []),
  settings: DEFAULT_SETTINGS,
  run: null,
  compare: null,
  errors: [],
  level: 'L0',
  followMode: true,
  followCore: false,
  playing: false,
  speed: 1,
  progress: 0,
  seekTo: null,
  playhead: EMPTY_PLAYHEAD,
  drawerOpen: false,
  selectedPid: null,
  tooltip: '',
  reducedMotion: prefersReducedMotion,

  setWorkload: (processes) => {
    set({ workload: normalise(processes) });
    get().recompute();
  },
  updateProcess: (pid, patch) => {
    set({ workload: get().workload.map((p) => (p.pid === pid ? { ...p, ...patch } : p)) });
    get().recompute();
  },
  addProcess: () => {
    const w = get().workload;
    const last = w[w.length - 1];
    const next: Process = { pid: w.length + 1, name: '', arrival: last ? last.arrival + 1 : 0, burst: 3, priority: 1, color: '' };
    get().setWorkload([...w, next]);
  },
  removeProcess: (pid) => get().setWorkload(get().workload.filter((p) => p.pid !== pid)),
  loadPreset: (id) => {
    const preset = presets.find((p) => p.id === id);
    if (preset) get().setWorkload(preset.processes);
  },
  randomize: (seed, size) => get().setWorkload(randomWorkload(seed, size)),
  setSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    get().recompute();
  },
  setAlgorithm: (algorithm) => get().setSettings({ algorithm }),
  recompute: () => {
    const { workload, settings } = get();
    const sim = simulate(workload, settings);
    if (!sim.ok) {
      set({ errors: sim.errors, playing: false });
      return;
    }
    const cmp = compareAll(workload, settings);
    set({
      errors: [],
      run: sim.result,
      compare: cmp.ok ? cmp.result : null,
      progress: 0,
      seekTo: 0,
      playhead: EMPTY_PLAYHEAD,
    });
  },
  setLevel: (level, opts) => set(opts?.manual ? { level, followMode: false } : { level }),
  setFollow: (on) => set({ followMode: on }),
  setFollowCore: (on) => set({ followCore: on }),
  play: () => set({ playing: true, followMode: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),
  seek: (t) => set({ seekTo: t }),
  clearSeek: () => set({ seekTo: null }),
  setProgress: (t) => set({ progress: t }),
  setPlayhead: (p) => set({ playhead: p }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  selectPid: (pid) => set({ selectedPid: pid }),
  setTooltip: (text) => set({ tooltip: text }),
}));
