import { describe, expect, it } from 'vitest';
import { TRANSITIONS, createGestureGate, deeper, levelForHit, shallower, transition } from './levels';

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
