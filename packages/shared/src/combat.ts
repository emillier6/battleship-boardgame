import type { Board, Coord, PlayerId, RoomState, Ship, ShotOutcome } from './types.js';
import { coordEq, inBounds, shipCells } from './board.js';

export interface ShotApplication {
  board: Board;
  outcome: ShotOutcome;
  sunkShipId?: string;
}

export interface ShotError {
  ok: false;
  reason: string;
}

export function alreadyShot(board: Board, at: Coord): boolean {
  return board.shotsReceived.some((s) => coordEq(s, at));
}

export function applyShot(board: Board, at: Coord): ShotApplication | ShotError {
  if (!inBounds(at, board.size)) {
    return { ok: false, reason: 'shot out of bounds' };
  }
  if (alreadyShot(board, at)) {
    return { ok: false, reason: 'cell already shot' };
  }

  const hitShipIdx = board.ships.findIndex((ship) =>
    shipCells(ship).some((c) => coordEq(c, at))
  );

  const newShotsReceived = [...board.shotsReceived, at];

  if (hitShipIdx === -1) {
    return {
      board: { ...board, shotsReceived: newShotsReceived },
      outcome: 'miss',
    };
  }

  const ship = board.ships[hitShipIdx]!;
  const newHits = [...ship.hits, at];
  const sunk = newHits.length >= ship.length;
  const updatedShip: Ship = { ...ship, hits: newHits, sunk };

  const newShips = board.ships.map((s, i) => (i === hitShipIdx ? updatedShip : s));

  return {
    board: { ...board, ships: newShips, shotsReceived: newShotsReceived },
    outcome: sunk ? 'sunk' : 'hit',
    sunkShipId: sunk ? ship.id : undefined,
  };
}

export function isGameOver(board: Board): boolean {
  if (board.ships.length === 0) return false;
  return board.ships.every((s) => s.sunk);
}

export function nextTurn(state: RoomState, _outcome: ShotOutcome): PlayerId | null {
  if (state.players.length < 2) return state.currentTurn;
  const current = state.currentTurn;
  const other = state.players.find((p) => p.id !== current);
  return other?.id ?? null;
}
