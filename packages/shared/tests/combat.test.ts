import { describe, it, expect } from 'vitest';
import { emptyBoard, placeShip } from '../src/board.js';
import { applyShot, isGameOver, nextTurn, alreadyShot } from '../src/combat.js';
import type { RoomState, Ship, ShotOutcome } from '../src/types.js';

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

describe('applyShot', () => {
  it('returns miss when shooting empty water', () => {
    const b = placeShip(emptyBoard(), ship({ origin: { x: 5, y: 5 } }));
    const r = applyShot(b, { x: 0, y: 0 });
    expect('outcome' in r && r.outcome).toBe('miss');
  });

  it('returns hit when partially hitting a ship', () => {
    const b = placeShip(emptyBoard(), ship({ origin: { x: 0, y: 0 }, length: 2 }));
    const r = applyShot(b, { x: 0, y: 0 });
    expect('outcome' in r && r.outcome).toBe('hit');
  });

  it('returns sunk when finishing a ship', () => {
    let b = placeShip(emptyBoard(), ship({ origin: { x: 0, y: 0 }, length: 2 }));
    const first = applyShot(b, { x: 0, y: 0 });
    if (!('board' in first)) throw new Error('expected hit');
    b = first.board;
    const second = applyShot(b, { x: 1, y: 0 });
    if (!('board' in second)) throw new Error('expected sunk');
    expect(second.outcome).toBe('sunk');
    expect(second.sunkShipId).toBe('s1');
    expect(second.board.ships[0]!.sunk).toBe(true);
  });

  it('rejects shot out of bounds', () => {
    const b = emptyBoard();
    const r = applyShot(b, { x: -1, y: 0 });
    expect('ok' in r && r.ok).toBe(false);
  });

  it('rejects duplicate shot', () => {
    let b = emptyBoard();
    const first = applyShot(b, { x: 3, y: 3 });
    if (!('board' in first)) throw new Error('expected result');
    b = first.board;
    const second = applyShot(b, { x: 3, y: 3 });
    expect('ok' in second && second.ok).toBe(false);
  });

  it('records shot in shotsReceived regardless of hit/miss', () => {
    const b = emptyBoard();
    const r = applyShot(b, { x: 4, y: 5 });
    if (!('board' in r)) throw new Error('expected result');
    expect(r.board.shotsReceived).toEqual([{ x: 4, y: 5 }]);
  });
});

describe('alreadyShot', () => {
  it('returns true when cell already shot', () => {
    const b = { ...emptyBoard(), shotsReceived: [{ x: 1, y: 2 }] };
    expect(alreadyShot(b, { x: 1, y: 2 })).toBe(true);
    expect(alreadyShot(b, { x: 0, y: 0 })).toBe(false);
  });
});

describe('isGameOver', () => {
  it('false for empty board', () => {
    expect(isGameOver(emptyBoard())).toBe(false);
  });

  it('false when some ships still afloat', () => {
    const b = placeShip(emptyBoard(), ship({ origin: { x: 0, y: 0 } }));
    expect(isGameOver(b)).toBe(false);
  });

  it('true when all ships sunk', () => {
    const sunkShip = ship({ origin: { x: 0, y: 0 }, length: 2, sunk: true });
    const b = placeShip(emptyBoard(), sunkShip);
    expect(isGameOver(b)).toBe(true);
  });
});

describe('nextTurn', () => {
  const room: RoomState = {
    code: 'ABC123',
    phase: 'BATTLE',
    players: [
      {
        id: 'p1', nickname: 'A', token: 't1', socketId: null, connected: true, ready: true,
        board: emptyBoard(), shotsFired: [],
      },
      {
        id: 'p2', nickname: 'B', token: 't2', socketId: null, connected: true, ready: true,
        board: emptyBoard(), shotsFired: [],
      },
    ],
    currentTurn: 'p1',
    winner: null,
    createdAt: 0,
    disconnectDeadlines: {},
  };

  it('switches to the other player after a shot', () => {
    expect(nextTurn(room, 'miss' as ShotOutcome)).toBe('p2');
  });

  it('switches even on hit (MVP rule)', () => {
    expect(nextTurn(room, 'hit' as ShotOutcome)).toBe('p2');
    expect(nextTurn(room, 'sunk' as ShotOutcome)).toBe('p2');
  });

  it('returns currentTurn if only one player', () => {
    const single = { ...room, players: [room.players[0]!] };
    expect(nextTurn(single, 'miss')).toBe('p1');
  });
});
