import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { CAMERA, LEVEL_RECTS, type Level } from '../scene/layout';
import { createGestureGate, deeper, shallower } from '../camera/levels';
import { useApp } from '../store/useApp';
import { CPU_STACK, H, U, rectCenter, type Vec3 } from './space';

const { ACTION } = CameraControlsImpl;

export const FOV = 32;
/** Tilt from vertical per level: oblique over the board, steeper over results. */
const POLAR: Record<Level, number> = { L0: 0.66, L1: 0.74, L2: 0.62, L3: 0.32 };
/** Breathing room around each level's rectangle (perspective enlarges the near edge). */
const PAD: Record<Level, number> = { L0: 1.04, L1: 1.16, L2: 1.08, L3: 1.05 };
const TARGET_Y: Record<Level, number> = { L0: 0, L1: 0.05, L2: CPU_STACK.dieTop, L3: H.resultsFloat * 0.8 };

/** Camera position and look-at target that frame a level's layout rectangle in the window. */
export function framing(level: Level, aspect: number): { pos: Vec3; target: Vec3 } {
  const r = LEVEL_RECTS[level];
  const target = rectCenter(r, TARGET_Y[level]);
  const polar = POLAR[level];
  const half = Math.tan(((FOV / 2) * Math.PI) / 180);
  // Narrow / portrait windows frame the active centre of the level instead of its full width
  // (brief §1: "on narrow screens the camera frames the active area"); the user can orbit or pan.
  const crop = aspect < 0.9 ? Math.max(level === 'L3' ? 0.62 : 0.45, aspect) : 1;
  const w = r.width * U * crop;
  const d = r.height * U;
  const dv = (d * Math.cos(polar)) / 2 / half;
  const dh = w / 2 / (half * Math.max(0.2, aspect));
  const dist = Math.max(dv, dh) * PAD[level];
  return {
    pos: [target[0], target[1] + dist * Math.cos(polar), target[2] + dist * Math.sin(polar)],
    target,
  };
}

function ignored(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"], [data-camera-ignore]') !== null;
}

/** Cinematic camera: flies between levels, lets the user orbit a little, wheel/pinch/Escape step levels. */
export default function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const dom = useThree((s) => s.gl.domElement);
  const level = useApp((s) => s.level);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const first = useRef(true);
  const lastLevel = useRef<Level>(level);

  // Fly to the level (animated), or re-frame instantly on resize.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const changed = lastLevel.current !== level;
    lastLevel.current = level;
    c.smoothTime = reducedMotion ? 0.12 : CAMERA.duration * 0.42;
    const f = framing(level, size.width / Math.max(1, size.height));
    void c.setLookAt(...f.pos, ...f.target, !first.current && changed);
    first.current = false;
  }, [level, reducedMotion, size.width, size.height]);

  // Manual camera input (orbit / truck) pauses auto-follow.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const onStart = () => useApp.getState().setFollow(false);
    c.addEventListener('controlstart', onStart);
    return () => c.removeEventListener('controlstart', onStart);
  }, []);

  // Wheel / trackpad pinch / two-finger pinch: one level per gesture.
  useEffect(() => {
    const gate = createGestureGate(CAMERA.wheelDebounceMs);
    const step = (dir: 1 | -1) => {
      if (!gate(performance.now())) return;
      const s = useApp.getState();
      const next = dir > 0 ? deeper(s.level) : shallower(s.level);
      if (next !== s.level) s.setLevel(next, { manual: true });
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 2) return;
      step(e.deltaY < 0 ? 1 : -1);
    };
    let pinch: number | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        pinch = null;
        return;
      }
      const d = dist(e.touches);
      if (pinch === null) pinch = d;
      else if (Math.abs(d - pinch) > 40) {
        step(d > pinch ? 1 : -1);
        pinch = d;
      }
    };
    const onTouchEnd = () => {
      pinch = null;
    };
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchmove', onTouchMove, { passive: true });
    dom.addEventListener('touchend', onTouchEnd);
    return () => {
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
    };
  }, [dom]);

  // Escape: one level out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || ignored(e.target)) return;
      const s = useApp.getState();
      const next = shallower(s.level);
      if (next !== s.level) s.setLevel(next, { manual: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minPolarAngle={0.12}
      maxPolarAngle={1.18}
      minAzimuthAngle={-0.85}
      maxAzimuthAngle={0.85}
      draggingSmoothTime={0.14}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.NONE, right: ACTION.TRUCK, wheel: ACTION.NONE }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.NONE, three: ACTION.NONE }}
    />
  );
}
