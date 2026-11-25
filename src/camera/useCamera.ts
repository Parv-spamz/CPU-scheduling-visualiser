import { useEffect } from 'react';
import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { CAMERA } from '../scene/layout';
import type { Level } from '../scene/layout';
import { ATTR } from '../scene/targets';
import { useApp } from '../store/useApp';
import {
  createGestureGate,
  deeper,
  interpolateViewBox,
  levelForHit,
  levelViewBox,
  lodFor,
  panViewBox,
  shallower,
  viewBoxString,
} from './levels';
import type { LodState, ViewBox } from './levels';
import './camera.css';

/** Pointer travel (CSS px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 5;
/** Pinch distance ratio that counts as one zoom step. */
const PINCH_IN_RATIO = 1.25;
const PINCH_OUT_RATIO = 0.8;

const IGNORE_SELECTOR = 'input, textarea, select, [contenteditable="true"], dialog, [role="dialog"], [data-camera-ignore]';

/** True when keyboard focus sits in a text field, dialog or the workload drawer. */
function focusIsInForm(): boolean {
  const el = document.activeElement;
  return el instanceof Element && el.closest(IGNORE_SELECTOR) !== null;
}

/**
 * Virtual camera (brief §7.5): tweens the svg `viewBox` between level rectangles with GSAP, writing the
 * attribute straight from the tween proxy (no React render per frame). Also owns wheel / pinch /
 * click / Escape / drag-pan input and the level-of-detail CSS variables.
 */
export function useCamera(svgRef: RefObject<SVGSVGElement | null>): void {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const aspect = (): number => {
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      return w > 0 && h > 0 ? w / h : window.innerWidth / Math.max(1, window.innerHeight);
    };

    let current: ViewBox = levelViewBox(useApp.getState().level, aspect());
    let pan = { dx: 0, dy: 0 };
    let lod: LodState | null = null;
    let tween: gsap.core.Animation | null = null;

    const apply = (v: ViewBox): void => {
      current = v;
      svg.setAttribute('viewBox', viewBoxString(v));
      const next = lodFor(v.width);
      if (!lod || lod.name !== next.name || lod.detail !== next.detail) {
        svg.style.setProperty('--lod-name', String(next.name));
        svg.style.setProperty('--lod-detail', String(next.detail));
        lod = next;
      }
    };

    /** The resting view for a level: fitted rect plus the (clamped) drag offset. */
    const resting = (level: Level): ViewBox => panViewBox(levelViewBox(level, aspect()), pan.dx, pan.dy);

    const killTween = (): void => {
      tween?.kill();
      tween = null;
      gsap.set(svg, { opacity: 1 });
    };

    const flyTo = (level: Level): void => {
      killTween();
      pan = { dx: 0, dy: 0 };
      const from = current;
      const to = resting(level);
      if (useApp.getState().reducedMotion) {
        const half = CAMERA.reducedMotionDuration / 2;
        tween = gsap
          .timeline({ onComplete: () => { tween = null; } })
          .to(svg, { opacity: 0, duration: half, ease: 'power1.out' })
          .call(() => apply(to))
          .to(svg, { opacity: 1, duration: half, ease: 'power1.in' });
        return;
      }
      const proxy = { p: 0 };
      tween = gsap.to(proxy, {
        p: 1,
        duration: CAMERA.duration,
        ease: CAMERA.ease,
        onUpdate: () => apply(interpolateViewBox(from, to, proxy.p)),
        onComplete: () => {
          apply(to);
          tween = null;
        },
      });
    };

    apply(current);

    // ---- Store subscription: animate on level change, never re-render React per frame. ----
    const unsubscribe = useApp.subscribe((state, prev) => {
      if (state.level !== prev.level) flyTo(state.level);
    });

    const go = (level: Level): void => {
      if (level !== useApp.getState().level) useApp.getState().setLevel(level, { manual: true });
    };

    // ---- Resize: recompute instantly from the current level and the new aspect. ----
    const onResize = (): void => {
      killTween();
      apply(resting(useApp.getState().level));
    };
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(svg);
    } else {
      window.addEventListener('resize', onResize);
    }

    // ---- Wheel and trackpad pinch (ctrl+wheel): one level per gesture. ----
    const wheelGate = createGestureGate(CAMERA.wheelDebounceMs);
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault(); // also blocks browser page-zoom on ctrl+wheel
      if (e.deltaY === 0 || focusIsInForm()) return;
      if (!wheelGate(e.timeStamp)) return;
      const level = useApp.getState().level;
      go(e.deltaY < 0 ? deeper(level) : shallower(level));
    };

    // ---- Pointer: drag to pan (one pointer), pinch to zoom (two touch pointers). ----
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { id: number; startX: number; startY: number; panX: number; panY: number; active: boolean } | null = null;
    let pinchStart = 0;
    let pinchDone = false;
    let suppressClick = false;
    const pinchGate = createGestureGate(CAMERA.wheelDebounceMs);

    const pinchDistance = (): number => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        suppressClick = false;
        drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, panX: pan.dx, panY: pan.dy, active: false };
      } else if (pointers.size === 2) {
        drag = null;
        suppressClick = true;
        pinchStart = pinchDistance();
        pinchDone = false;
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        if (pinchDone || pinchStart <= 0) return;
        const ratio = pinchDistance() / pinchStart;
        if (ratio < PINCH_IN_RATIO && ratio > PINCH_OUT_RATIO) return;
        pinchDone = true;
        if (!pinchGate(e.timeStamp)) return;
        const level = useApp.getState().level;
        go(ratio >= PINCH_IN_RATIO ? deeper(level) : shallower(level));
        return;
      }

      if (!drag || drag.id !== e.pointerId) return;
      const sx = e.clientX - drag.startX;
      const sy = e.clientY - drag.startY;
      if (!drag.active) {
        if (Math.hypot(sx, sy) < DRAG_THRESHOLD_PX || tween) return;
        drag.active = true;
        suppressClick = true;
        svg.setPointerCapture(e.pointerId);
        svg.style.cursor = 'grabbing';
      }
      // Screen px → world units: the viewBox matches the window aspect, so one scale fits both axes.
      const scale = current.width / Math.max(1, svg.clientWidth);
      const base = levelViewBox(useApp.getState().level, aspect());
      const next = panViewBox(base, drag.panX - sx * scale, drag.panY - sy * scale);
      pan = { dx: next.x - base.x, dy: next.y - base.y };
      apply(next);
    };

    const onPointerUp = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (drag?.id === e.pointerId) {
        if (drag.active && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
        svg.style.cursor = '';
        drag = null;
      }
      if (pointers.size < 2) pinchStart = 0;
    };

    // ---- Click delegation on [data-hit]; a drag or pinch never counts as a click. ----
    const onClick = (e: MouseEvent): void => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const target = e.target instanceof Element ? e.target.closest(`[${ATTR.hit}]`) : null;
      const hit = target?.getAttribute(ATTR.hit);
      if (!hit) return;
      const level = levelForHit(hit, useApp.getState().level);
      if (level) go(level);
    };

    // ---- Escape: one level out (L2→L1→L0, L3→L0). ----
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (focusIsInForm()) return;
      const level = useApp.getState().level;
      const out = shallower(level);
      if (out !== level) {
        e.preventDefault();
        go(out);
      }
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubscribe();
      killTween();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onResize);
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointercancel', onPointerUp);
      svg.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [svgRef]);
}
