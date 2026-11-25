import { beforeEach, describe, expect, it } from 'vitest';
import { presets } from '../engine';
import { EMPTY_PLAYHEAD, useApp } from './useApp';

const initial = useApp.getState();

beforeEach(() => {
  useApp.setState(initial, true);
  useApp.getState().recompute();
});

describe('store: runs follow the inputs', () => {
  it('recompute produces a run and a comparison for the default workload', () => {
    const s = useApp.getState();
    expect(s.errors).toEqual([]);
    expect(s.run?.settings.algorithm).toBe('fcfs');
    expect(s.compare?.runs.rr).toBeDefined();
  });

  it('switching algorithm re-runs and rewinds playback', () => {
    useApp.setState({ progress: 7, playhead: { ...EMPTY_PLAYHEAD, clock: 7 } });
    useApp.getState().setAlgorithm('rr');
    const s = useApp.getState();
    expect(s.run?.settings.algorithm).toBe('rr');
    expect(s.progress).toBe(0);
    expect(s.seekTo).toBe(0);
    expect(s.playhead).toEqual(EMPTY_PLAYHEAD);
  });

  it('keeps chip colours stable across algorithms (colour depends on pid only)', () => {
    const before = useApp.getState().run!.processes.map((p) => p.color);
    useApp.getState().setAlgorithm('priority');
    expect(useApp.getState().run!.processes.map((p) => p.color)).toEqual(before);
  });

  it('invalid input shows errors, stops playback and keeps the last good run', () => {
    const good = useApp.getState().run;
    useApp.setState({ playing: true });
    useApp.getState().updateProcess(1, { burst: 0 });
    const s = useApp.getState();
    expect(s.errors.length).toBeGreaterThan(0);
    expect(s.playing).toBe(false);
    expect(s.run).toBe(good);
  });

  it('removing a process renumbers pids 1..n', () => {
    useApp.getState().removeProcess(1);
    const pids = useApp.getState().workload.map((p) => p.pid);
    expect(pids).toEqual(pids.map((_, i) => i + 1));
  });

  it('loads every preset without errors', () => {
    for (const p of presets) {
      useApp.getState().loadPreset(p.id);
      expect(useApp.getState().errors).toEqual([]);
      expect(useApp.getState().workload).toHaveLength(p.processes.length);
    }
  });
});

describe('store: camera follow mode', () => {
  it('a manual level change turns auto-follow off, an automatic one does not', () => {
    useApp.getState().setLevel('L1');
    expect(useApp.getState().followMode).toBe(true);
    useApp.getState().setLevel('L2', { manual: true });
    expect(useApp.getState().followMode).toBe(false);
  });

  it('pressing Play turns auto-follow back on', () => {
    useApp.getState().setLevel('L2', { manual: true });
    useApp.getState().togglePlay();
    expect(useApp.getState().playing).toBe(true);
    expect(useApp.getState().followMode).toBe(true);
    useApp.getState().togglePlay();
    expect(useApp.getState().playing).toBe(false);
  });
});
