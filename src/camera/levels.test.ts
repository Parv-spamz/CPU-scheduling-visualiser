import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_RECTS, LOD, WORLD } from '../scene/layout';
import type { Level, Rect } from '../scene/layout';
import {
  TRANSITIONS,
  createGestureGate,
  deeper,
  fitRect,
  interpolateViewBox,
  levelForHit,
  lodFor,
  panViewBox,
  shallower,
  transition,
  viewBoxString,
} from './levels';

const contains = (outer: Rect, inner: Rect): boolean =>
  outer.x <= inner.x + 1e-9 &&
  outer.y <= inner.y + 1e-9 &&
  outer.x + outer.width >= inner.x + inner.width - 1e-9 &&
  outer.y + outer.height >= inner.y + inner.height - 1e-9;

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

describe('fitRect', () => {
  const aspects = [16 / 9, 4 / 3, 1, 9 / 16, 21 / 9, 375 / 812];
  for (const level of LEVELS) {
    for (const aspect of aspects) {
      it(`${level} at aspect ${aspect.toFixed(2)} keeps aspect, contains and centres the rect`, () => {
        const rect = LEVEL_RECTS[level];
        const v = fitRect(rect, aspect);
        expect(v.width / v.height).toBeCloseTo(aspect, 9);
        expect(contains(v, rect)).toBe(true);
        expect(centre(v).x).toBeCloseTo(centre(rect).x, 9);
        expect(centre(v).y).toBeCloseTo(centre(rect).y, 9);
        // Tight: one dimension matches the rect exactly.
        expect(Math.abs(v.width - rect.width) < 1e-9 || Math.abs(v.height - rect.height) < 1e-9).toBe(true);
      });
    }
  }

  it('wide window widens the board view', () => {
    expect(fitRect(LEVEL_RECTS.L0, 2)).toEqual({ x: -200, y: 0, width: 2000, height: 1000 });
  });

  it('tall window heightens the core view', () => {
    expect(fitRect(LEVEL_RECTS.L2, 0.5)).toEqual({ x: 560, y: 120, width: 280, height: 560 });
  });

  it('falls back to the rect aspect for invalid input', () => {
    expect(fitRect(LEVEL_RECTS.L1, 0)).toEqual(LEVEL_RECTS.L1);
    expect(fitRect(LEVEL_RECTS.L1, Number.NaN)).toEqual(LEVEL_RECTS.L1);
  });
});

describe('interpolateViewBox', () => {
  const a: Rect = { x: 0, y: 0, width: 1600, height: 1000 };
  const b: Rect = { x: 600, y: 300, width: 400, height: 250 };

  it('returns the endpoints at p = 0 and p = 1', () => {
    const v0 = interpolateViewBox(a, b, 0);
    const v1 = interpolateViewBox(a, b, 1);
    for (const k of ['x', 'y', 'width', 'height'] as const) {
      expect(v0[k]).toBeCloseTo(a[k], 9);
      expect(v1[k]).toBeCloseTo(b[k], 9);
    }
  });

  it('midpoint width is the geometric mean (log space), centre is the linear midpoint', () => {
    const m = interpolateViewBox(a, b, 0.5);
    expect(m.width).toBeCloseTo(Math.sqrt(1600 * 400), 9); // 800, not the linear 1000
    expect(m.height).toBeCloseTo(Math.sqrt(1000 * 250), 9);
    expect(centre(m).x).toBeCloseTo((800 + 800) / 2, 9);
    expect(centre(m).y).toBeCloseTo((500 + 425) / 2, 9);
  });

  it('zoom changes by a constant factor per step', () => {
    const w = [0, 0.25, 0.5, 0.75, 1].map((p) => interpolateViewBox(a, b, p).width);
    const ratios = w.slice(1).map((x, i) => x / (w[i] as number));
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0] as number, 9);
  });

  it('keeps the shared aspect throughout', () => {
    for (const p of [0.1, 0.33, 0.9]) {
      const v = interpolateViewBox(a, b, p);
      expect(v.width / v.height).toBeCloseTo(1.6, 9);
    }
  });
});

describe('level of detail', () => {
  it('follows the LOD thresholds on zoom = 1600 / width', () => {
    expect(lodFor(WORLD.width)).toEqual({ name: 0, detail: 0 });
    expect(lodFor(WORLD.width / LOD.names)).toEqual({ name: 1, detail: 0 });
    expect(lodFor(WORLD.width / LOD.detail)).toEqual({ name: 1, detail: 1 });
  });

  it('16:9 window: names on at L1, detail on at L2, nothing at L0', () => {
    const at = (l: Level) => lodFor(fitRect(LEVEL_RECTS[l], 16 / 9).width);
    expect(at('L0')).toEqual({ name: 0, detail: 0 });
    expect(at('L1')).toEqual({ name: 1, detail: 0 });
    expect(at('L2')).toEqual({ name: 1, detail: 1 });
  });
});

describe('panViewBox', () => {
  it('clamps a zoomed view inside the world', () => {
    const base = fitRect(LEVEL_RECTS.L2, 1);
    expect(panViewBox(base, -10_000, -10_000)).toMatchObject({ x: 0, y: 0 });
    const far = panViewBox(base, 10_000, 10_000);
    expect(far.x + far.width).toBeCloseTo(WORLD.width, 9);
    expect(far.y + far.height).toBeCloseTo(WORLD.height, 9);
    expect(panViewBox(base, 20, -30)).toMatchObject({ x: base.x + 20, y: base.y - 30 });
  });

  it('does not pan an axis where the view already shows the whole world', () => {
    const base = fitRect(LEVEL_RECTS.L0, 16 / 9);
    expect(panViewBox(base, 300, 300)).toEqual(base);
  });
});

describe('level transitions', () => {
  it('deeper / shallower walk Board → CPU → Core and back', () => {
    expect(deeper('L0')).toBe('L1');
    expect(deeper('L1')).toBe('L2');
    expect(deeper('L2')).toBe('L2');
    expect(shallower('L2')).toBe('L1');
    expect(shallower('L1')).toBe('L0');
    expect(shallower('L0')).toBe('L0');
    expect(shallower('L3')).toBe('L0');
    expect(deeper('L3')).toBe('L1');
  });

  it('shallower undoes deeper for L0 and L1', () => {
    for (const l of ['L0', 'L1'] as const) expect(shallower(deeper(l))).toBe(l);
  });

  it('follows the §8.2 table', () => {
    expect(transition('L0', 'clickCpu')).toBe('L1');
    expect(transition('L0', 'firstDispatch')).toBe('L1');
    expect(transition('L1', 'clickCore')).toBe('L2');
    expect(transition('L1', 'stepIntoSlice')).toBe('L2');
    expect(transition('L2', 'back')).toBe('L1');
    expect(transition('L2', 'sliceEnds')).toBe('L1');
    expect(transition('L1', 'runFinishes')).toBe('L3');
    expect(transition('L1', 'compare')).toBe('L3');
    expect(transition('L3', 'clickMiniCpu')).toBe('L1');
    expect(transition('L0', 'sliceEnds')).toBe('L0');
  });

  it('every transition can be reversed by some trigger or by shallower()', () => {
    for (const t of TRANSITIONS) {
      const back = TRANSITIONS.some((u) => u.from === t.to && u.to === t.from) || shallower(t.to) === t.from;
      expect(back, `${t.from} -${t.trigger}-> ${t.to}`).toBe(true);
    }
  });

  it('maps click targets to levels', () => {
    expect(levelForHit('cpu', 'L0')).toBe('L1');
    expect(levelForHit('core', 'L0')).toBe('L1');
    expect(levelForHit('core', 'L1')).toBe('L2');
    expect(levelForHit('board', 'L1')).toBeNull();
    expect(levelForHit('unknown', 'L0')).toBeNull();
  });
});

describe('gesture gate', () => {
  it('passes the first event and swallows the rest of a continuous gesture', () => {
    const gate = createGestureGate(400);
    expect(gate(0)).toBe(true);
    expect(gate(100)).toBe(false);
    expect(gate(450)).toBe(false); // still within 400 ms of the previous event
    expect(gate(900)).toBe(true);
  });
});

describe('viewBoxString', () => {
  it('rounds to two decimals', () => {
    expect(viewBoxString({ x: 1 / 3, y: 0, width: 1600, height: 1000.005 })).toBe('0.33 0 1600 1000.01');
  });
});
