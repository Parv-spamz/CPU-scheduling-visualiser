import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useApp } from '../store/useApp';
import { PLAYBACK } from '../scene/layout';
import { buildPlan, playheadAt, secondsAt, tickAt } from './keyframes';
import { rt } from './runtime';
import { loadFromQueue, planEndSec, queueLengthAt } from './sceneState';

const PROGRESS_HZ = 10;

/**
 * The playback clock. Lives inside the R3F canvas so it advances in the render loop.
 * It owns `rt.sec`, writes coarse values to the store (progress ~10x/s, playhead only when the
 * integer tick changes) and drives auto-follow of the camera.
 */
export default function PlayerDriver() {
  const lastTick = useRef<number | null>(null);
  const lastProgressAt = useRef(0);
  const wasPlaying = useRef(false);
  const endReachedAt = useRef<number | null>(null);

  // Rebuild the replay plan whenever the run changes.
  useEffect(() => {
    const apply = () => {
      const { run, reducedMotion } = useApp.getState();
      rt.run = run;
      rt.plan = run ? buildPlan(run, { reducedMotion }) : null;
      rt.sec = 0;
      rt.t = run ? tickAt(run, 0) : 0;
      lastTick.current = null;
      endReachedAt.current = null;
    };
    apply();
    return useApp.subscribe((s, prev) => {
      if (s.run !== prev.run || s.reducedMotion !== prev.reducedMotion) apply();
    });
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) useApp.getState().pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useFrame((state, delta) => {
    rt.clock = state.clock.elapsedTime;
    const s = useApp.getState();
    const run = rt.run;
    const plan = rt.plan;
    if (!run || !plan) return;
    const endSec = planEndSec(plan);
    const finalTick = plan.end;

    if (s.seekTo !== null) {
      rt.sec = Math.min(endSec, Math.max(0, secondsAt(run, s.seekTo)));
      endReachedAt.current = null;
      s.clearSeek();
    }

    if (s.playing && !wasPlaying.current && rt.sec >= endSec - 1e-6) {
      rt.sec = 0; // Play at the end restarts the run.
      endReachedAt.current = null;
    }
    wasPlaying.current = s.playing;

    if (s.playing) {
      rt.sec += Math.min(delta, 0.1) * s.speed;
      if (rt.sec >= endSec) {
        rt.sec = endSec;
        endReachedAt.current = state.clock.elapsedTime;
        s.pause();
        s.setProgress(finalTick);
      }
    }
    rt.t = tickAt(run, rt.sec);
    const tClamped = Math.min(rt.t, finalTick);

    // Smoothed CPU pressure for the overload glow.
    const target = loadFromQueue(queueLengthAt(run, tClamped));
    rt.load += (target - rt.load) * Math.min(1, delta * 3);

    // Coarse store writes.
    const tick = Math.floor(tClamped + 1e-6);
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      s.setPlayhead(playheadAt(run, tick));
    }
    const now = state.clock.elapsedTime;
    if (now - lastProgressAt.current > 1 / PROGRESS_HZ && Math.abs(s.progress - tClamped) > 1e-4) {
      lastProgressAt.current = now;
      s.setProgress(tClamped);
    }

    // Auto-follow (brief §8.5). Manual input clears followMode and stops all of this.
    if (!s.followMode) return;
    if (s.playing && s.level === 'L0' && rt.sec >= plan.firstDispatchAt) s.setLevel('L1');
    if (s.playing && s.level === 'L3') s.setLevel(rt.sec >= plan.firstDispatchAt ? 'L1' : 'L0');
    if (s.playing && s.followCore && s.level === 'L1') s.setLevel('L2');
    if (endReachedAt.current !== null && now - endReachedAt.current >= PLAYBACK.holdBeforeResults) {
      endReachedAt.current = null;
      if (s.level !== 'L3') s.setLevel('L3');
    }
  });

  return null;
}
