import { describe, it, expect } from 'vitest';
import { emptyBoard, placeShip } from '../src/board.js';
import { applyShot } from '../src/combat.js';
import { toOpponentView, lastShot, isCellShot } from '../src/views.js';
import type { Ship } from '../src/types.js';

const ship = (overrides: Partial<Ship> = {}): Ship => ({
  id: 's1',
  kind: 'destroyer',
  length: 2,
  origin: { x: 0, y: 0 },
  orientation: 'H',
  hits: [],
  sunk: false,
  ...overrides,
});

describe('toOpponentView', () => {
  it('never reveals ships that are not sunk', () => {
    const b = placeShip(emptyBoard(), ship({ origin: { x: 4, y: 4 }, length: 3 }));
    const view = toOpponentView(b);
    expect(view.sunkShips).toEqual([]);
    expect(view.shots).toEqual([]);
    expect(view.size).toBe(b.size);
  });

  it('reveals sunk ships', () => {
    let b = placeShip(emptyBoard(), ship({ origin: { x: 0, y: 0 }, length: 2 }));
    const r1 = applyShot(b, { x: 0, y: 0 });
    if (!('board' in r1)) throw new Error('expected result');
    const r2 = applyShot(r1.board, { x: 1, y: 0 });
    if (!('board' in r2)) throw new Error('expected result');
    const view = toOpponentView(r2.board);
    expect(view.sunkShips).toHaveLength(1);
    expect(view.sunkShips[0]!.sunk).toBe(true);
  });

  it('classifies shots as hit/miss', () => {
    let b = placeShip(emptyBoard(), ship({ origin: { x: 2, y: 2 }, length: 2 }));
    const miss = applyShot(b, { x: 9, y: 9 });
    if (!('board' in miss)) throw new Error('expected result');
    const hit = applyShot(miss.board, { x: 2, y: 2 });
    if (!('board' in hit)) throw new Error('expected result');
    const view = toOpponentView(hit.board);
    expect(view.shots).toEqual([
      { at: { x: 9, y: 9 }, outcome: 'miss' },
      { at: { x: 2, y: 2 }, outcome: 'hit' },
    ]);
  });
});

describe('lastShot', () => {
  it('returns null on empty', () => {
    expect(lastShot(emptyBoard())).toBeNull();
  });

  it('returns the most recent shot', () => {
    const b = { ...emptyBoard(), shotsReceived: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
    expect(lastShot(b)).toEqual({ x: 2, y: 2 });
  });
});

describe('isCellShot', () => {
  it('checks shot list', () => {
    const b = { ...emptyBoard(), shotsReceived: [{ x: 1, y: 1 }] };
    expect(isCellShot(b, { x: 1, y: 1 })).toBe(true);
    expect(isCellShot(b, { x: 0, y: 0 })).toBe(false);
  });
});
