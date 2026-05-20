import { describe, it, expect } from 'vitest';
import {
  emptyBoard,
  shipCells,
  validateShipPlacement,
  placeShip,
  placeFleet,
} from '../src/board.js';
import { BOARD_SIZE, FLEET } from '../src/constants.js';
import type { Ship } from '../src/types.js';

const makeShip = (overrides: Partial<Ship>): Ship => ({
  id: 'carrier',
  kind: 'carrier',
  length: 5,
  origin: { x: 0, y: 0 },
  orientation: 'H',
  hits: [],
  sunk: false,
  ...overrides,
});

describe('emptyBoard', () => {
  it('creates an empty board with default size', () => {
    const b = emptyBoard();
    expect(b.size).toBe(BOARD_SIZE);
    expect(b.ships).toEqual([]);
    expect(b.shotsReceived).toEqual([]);
  });

  it('accepts a custom size', () => {
    expect(emptyBoard(5).size).toBe(5);
  });
});

describe('shipCells', () => {
  it('returns cells for horizontal ship', () => {
    const cells = shipCells(makeShip({ origin: { x: 2, y: 3 }, length: 3, orientation: 'H' }));
    expect(cells).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });

  it('returns cells for vertical ship', () => {
    const cells = shipCells(makeShip({ origin: { x: 1, y: 1 }, length: 2, orientation: 'V' }));
    expect(cells).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
  });
});

describe('validateShipPlacement', () => {
  it('accepts a valid placement on empty board', () => {
    const b = emptyBoard();
    expect(validateShipPlacement(b, makeShip({}))).toEqual({ ok: true });
  });

  it('rejects ship out of bounds (right edge)', () => {
    const b = emptyBoard();
    const ship = makeShip({ origin: { x: 8, y: 0 }, length: 5, orientation: 'H' });
    const r = validateShipPlacement(b, ship);
    expect(r.ok).toBe(false);
  });

  it('rejects ship out of bounds (bottom edge)', () => {
    const b = emptyBoard();
    const ship = makeShip({ origin: { x: 0, y: 8 }, length: 5, orientation: 'V' });
    expect(validateShipPlacement(b, ship).ok).toBe(false);
  });

  it('rejects negative origin', () => {
    const b = emptyBoard();
    const ship = makeShip({ origin: { x: -1, y: 0 } });
    expect(validateShipPlacement(b, ship).ok).toBe(false);
  });

  it('rejects overlap', () => {
    let b = emptyBoard();
    b = placeShip(b, makeShip({ id: 'a', origin: { x: 0, y: 0 } }));
    const overlapping = makeShip({ id: 'b', origin: { x: 2, y: 0 } });
    const r = validateShipPlacement(b, overlapping);
    expect(r.ok).toBe(false);
  });

  it('rejects diagonal adjacency (NO_SHIP_ADJACENCY=true)', () => {
    let b = emptyBoard();
    b = placeShip(b, makeShip({ id: 'a', origin: { x: 0, y: 0 }, length: 2, orientation: 'H' }));
    const diagAdjacent = makeShip({
      id: 'b',
      origin: { x: 2, y: 1 },
      length: 2,
      orientation: 'H',
    });
    expect(validateShipPlacement(b, diagAdjacent).ok).toBe(false);
  });

  it('accepts placement separated by 2 cells', () => {
    let b = emptyBoard();
    b = placeShip(b, makeShip({ id: 'a', origin: { x: 0, y: 0 }, length: 2, orientation: 'H' }));
    const far = makeShip({
      id: 'b',
      origin: { x: 0, y: 2 },
      length: 2,
      orientation: 'H',
    });
    expect(validateShipPlacement(b, far).ok).toBe(true);
  });

  it('ignores self when re-placing same id', () => {
    let b = emptyBoard();
    const ship = makeShip({ id: 'a', origin: { x: 0, y: 0 } });
    b = placeShip(b, ship);
    const replaced = { ...ship, origin: { x: 0, y: 0 } };
    expect(validateShipPlacement(b, replaced).ok).toBe(true);
  });
});

describe('placeShip', () => {
  it('adds a ship immutably', () => {
    const b = emptyBoard();
    const ship = makeShip({ id: 'a' });
    const b2 = placeShip(b, ship);
    expect(b.ships).toHaveLength(0);
    expect(b2.ships).toHaveLength(1);
  });

  it('replaces ship with same id', () => {
    let b = emptyBoard();
    b = placeShip(b, makeShip({ id: 'a', origin: { x: 0, y: 0 } }));
    b = placeShip(b, makeShip({ id: 'a', origin: { x: 5, y: 5 } }));
    expect(b.ships).toHaveLength(1);
    expect(b.ships[0]!.origin).toEqual({ x: 5, y: 5 });
  });
});

describe('placeFleet', () => {
  const buildValidFleet = (): Ship[] => [
    makeShip({ id: 'carrier', kind: 'carrier', length: 5, origin: { x: 0, y: 0 }, orientation: 'H' }),
    makeShip({ id: 'battleship', kind: 'battleship', length: 4, origin: { x: 0, y: 2 }, orientation: 'H' }),
    makeShip({ id: 'cruiser', kind: 'cruiser', length: 3, origin: { x: 0, y: 4 }, orientation: 'H' }),
    makeShip({ id: 'submarine', kind: 'submarine', length: 3, origin: { x: 0, y: 6 }, orientation: 'H' }),
    makeShip({ id: 'destroyer', kind: 'destroyer', length: 2, origin: { x: 0, y: 8 }, orientation: 'H' }),
  ];

  it('accepts a valid full fleet', () => {
    const r = placeFleet(emptyBoard(), buildValidFleet());
    expect(r).toEqual({ ok: true });
  });

  it('rejects fleet with wrong count', () => {
    const r = placeFleet(emptyBoard(), buildValidFleet().slice(0, 3));
    expect(r.ok).toBe(false);
  });

  it('rejects fleet with wrong length for a kind', () => {
    const fleet = buildValidFleet();
    fleet[0] = { ...fleet[0]!, length: 4 };
    expect(placeFleet(emptyBoard(), fleet).ok).toBe(false);
  });

  it('rejects fleet with duplicate kind', () => {
    const fleet = buildValidFleet();
    fleet[1] = { ...fleet[0]!, id: 'carrier2' };
    expect(placeFleet(emptyBoard(), fleet).ok).toBe(false);
  });

  it('FLEET constant has expected shape', () => {
    expect(FLEET).toHaveLength(5);
    expect(FLEET.map((s) => s.length).sort()).toEqual([2, 3, 3, 4, 5]);
  });
});
