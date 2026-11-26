import { useEffect } from 'react';
import { ALGORITHMS } from '../../engine/types';
import type { RunResult } from '../../engine/types';
import { useApp } from '../../store/useApp';
import { PLAYBACK } from '../../scene/layout';

const EPS = 1e-6;

const IGNORE_SELECTOR =
  'input, select, textarea, button, a[href], [role="button"], [contenteditable=""], [contenteditable="true"], [data-camera-ignore]';

/** Same target as the playback bar's step buttons: previous / next event time, clamped to the run. */
export function stepTarget(run: RunResult, current: number, dir: -1 | 1): number {
  const start = run.segments[0]?.start ?? 0;
  const end = Math.max(run.segments[run.segments.length - 1]?.end ?? start, start + run.makespan);
  const times = Array.from(new Set(run.events.map((e) => e.time))).sort((a, b) => a - b);
  const cur = Math.min(end, Math.max(start, current));
  return dir < 0 ? ([...times].reverse().find((t) => t < cur - EPS) ?? start) : (times.find((t) => t > cur + EPS) ?? end);
}

function ignored(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return true;
  const t = e.target;
  return t instanceof Element && t.closest(IGNORE_SELECTOR) !== null;
}

/**
 * Global shortcuts (brief §8.4): Space play/pause, Left/Right step to the previous/next event,
 * 1-4 pick FCFS / SJF / Priority / Round Robin, [ and ] change speed, D opens the drawer, F toggles follow.
 * Escape and R belong to the camera; I and ? are handled by the insights card and the help sheet.
 */
export function useKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (ignored(e)) return;
      const s = useApp.getState();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (e.repeat || !s.run) return;
        if (!s.playing && s.errors.length > 0) return;
        s.togglePlay();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!s.run || s.run.segments.length === 0) return;
        e.preventDefault();
        s.pause();
        s.seek(stepTarget(s.run, s.seekTo ?? s.progress, e.key === 'ArrowLeft' ? -1 : 1));
        return;
      }
      if (!e.repeat && (e.key === '[' || e.key === ']')) {
        const list = PLAYBACK.speeds;
        const i = list.indexOf(s.speed);
        const next = list[Math.min(list.length - 1, Math.max(0, (i < 0 ? list.indexOf(1) : i) + (e.key === ']' ? 1 : -1)))];
        if (next !== undefined) s.setSpeed(next);
        return;
      }
      if (!e.repeat && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        s.setDrawerOpen(!s.drawerOpen);
        return;
      }
      if (!e.repeat && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        s.setFollow(!s.followMode);
        return;
      }
      if (!e.repeat && e.key >= '1' && e.key <= '4' && !e.shiftKey) {
        const algo = ALGORITHMS[Number(e.key) - 1];
        if (algo) {
          e.preventDefault();
          if (s.settings.algorithm !== algo) s.setAlgorithm(algo);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
