import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, LEVEL_RECTS, type Level } from '../../scene/layout';
import { shallower } from '../../camera/levels';
import { RESET_VIEW_EVENT } from '../../camera/events';
import { useApp } from '../../store/useApp';
import { CPU_STACK, H, U, rectCenter, type Vec3 } from '../kit/space';

const { ACTION } = CameraControlsImpl;

export const FOV = 42;
/** Default view: from the front-left, the rear I/O side, like a product shot of a board. */
const AZIMUTH = -0.45;
/** Tilt from vertical per level. */
const POLAR: Record<Level, number> = { L0: 1.18, L1: 0.9, L2: 0.7, L3: 0.36 };
/** Breathing room around each level's rectangle. */
const PAD: Record<Level, number> = { L0: 1.5, L1: 1.08, L2: 1.6, L3: 1.18 };
const TARGET_Y: Record<Level, number> = { L0: 2.2, L1: H.dimmModule * 0.3, L2: CPU_STACK.dieTop, L3: H.resultsFloat * 0.8 };

/** Camera position and look-at target that frame a level's layout rectangle in the window. */
export function framing(level: Level, aspect: number): { pos: Vec3; target: Vec3 } {
  const r = LEVEL_RECTS[level];
  const target = rectCenter(r, TARGET_Y[level]);
  const polar = POLAR[level];
  const az = level === 'L3' ? 0 : AZIMUTH;
  const half = Math.tan(((FOV / 2) * Math.PI) / 180);
  // Narrow windows frame the busy centre of the level; the user can drag, pan and zoom from there.
  const crop = aspect < 0.9 ? Math.max(0.5, aspect) : 1;
  const w = r.width * U * crop;
  const d = r.height * U;
  // Rotated footprint, so the framed board fits at the default azimuth.
  const sw = Math.abs(w * Math.cos(az)) + Math.abs(d * Math.sin(az));
  const sd = Math.abs(w * Math.sin(az)) + Math.abs(d * Math.cos(az));
  const dv = (sd * Math.cos(polar)) / 2 / half;
  const dh = sw / 2 / (half * Math.max(0.2, aspect));
  const dist = Math.max(dv, dh) * PAD[level];
  const s = Math.sin(polar);
  return {
    pos: [target[0] + dist * s * Math.sin(az), target[1] + dist * Math.cos(polar), target[2] + dist * s * Math.cos(az)],
    target,
  };
}

function ignored(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, select, textarea, button, [contenteditable="true"], [data-camera-ignore]') !== null;
}

/**
 * Orbit camera that stays around the board (it never leaves the room): drag to rotate, scroll or pinch to zoom, right-drag or
 * two-finger drag to pan. Changing level flies to that level's default view; Escape steps out;
 * R (or the reset button) returns to the default view.
 */
export default function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const level = useApp((s) => s.level);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const first = useRef(true);
  const touched = useRef(false);
  const lastLevel = useRef<Level>(level);

  // Fly to a level's view when it changes. A resize re-frames only if the user has not moved the camera.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const changed = lastLevel.current !== level;
    lastLevel.current = level;
    if (!changed && !first.current && touched.current) return;
    if (changed) touched.current = false;
    c.smoothTime = reducedMotion ? 0.12 : CAMERA.duration * 0.42;
    const f = framing(level, size.width / Math.max(1, size.height));
    void c.setLookAt(...f.pos, ...f.target, !first.current && changed);
    first.current = false;
  }, [level, reducedMotion, size.width, size.height]);

  // The camera stays around the board: the look-at point cannot leave the bed's centre.
  useEffect(() => {
    ref.current?.setBoundary(new THREE.Box3(new THREE.Vector3(-9, -0.4, -10), new THREE.Vector3(9, 4.6, 10)));
  }, []);

  // Manual camera input pauses auto-follow and keeps the user's view through resizes.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const onStart = () => {
      touched.current = true;
      useApp.getState().setFollow(false);
    };
    c.addEventListener('controlstart', onStart);
    return () => c.removeEventListener('controlstart', onStart);
  }, []);

  // Reset view (button or R) and Escape (one level out).
  useEffect(() => {
    const reset = () => {
      const c = ref.current;
      if (!c) return;
      touched.current = false;
      const s = useApp.getState();
      c.smoothTime = s.reducedMotion ? 0.12 : CAMERA.duration * 0.42;
      const f = framing(s.level, size.width / Math.max(1, size.height));
      void c.setLookAt(...f.pos, ...f.target, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || ignored(e.target)) return;
      if (e.key === 'Escape') {
        const s = useApp.getState();
        const next = shallower(s.level);
        if (next !== s.level) s.setLevel(next, { manual: true });
      } else if (e.key === 'r' || e.key === 'R') reset();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(RESET_VIEW_EVENT, reset);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(RESET_VIEW_EVENT, reset);
    };
  }, [size.width, size.height]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minPolarAngle={0.05}
      maxPolarAngle={1.4}
      minAzimuthAngle={-2}
      maxAzimuthAngle={2}
      minDistance={1.2}
      maxDistance={30}
      dollySpeed={0.6}
      dollyToCursor
      draggingSmoothTime={0.04}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.TRUCK, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY_TRUCK, three: ACTION.TOUCH_TRUCK }}
    />
  );
}
