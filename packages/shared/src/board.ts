import type { Board, Coord, PlacementResult, Ship } from './types.js';
import { BOARD_SIZE, FLEET, NO_SHIP_ADJACENCY } from './constants.js';

export function emptyBoard(size: number = BOARD_SIZE): Board {
  return { size, ships: [], shotsReceived: [] };
}

export function shipCells(ship: Ship): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < ship.length; i++) {
    cells.push({
      x: ship.origin.x + (ship.orientation === 'H' ? i : 0),
      y: ship.origin.y + (ship.orientation === 'V' ? i : 0),
    });
  }
  return cells;
}

export function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(c: Coord, size: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < size && c.y < size;
}

function adjacentCells(c: Coord): Coord[] {
  const out: Coord[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: c.x + dx, y: c.y + dy });
    }
  }
  return out;
}

export function validateShipPlacement(board: Board, ship: Ship): PlacementResult {
  if (ship.length < 1) return { ok: false, reason: 'ship length must be >= 1' };

  const cells = shipCells(ship);
  for (const cell of cells) {
    if (!inBounds(cell, board.size)) {
      return { ok: false, reason: 'ship out of bounds' };
    }
  }

  const occupied = new Set<string>();
  for (const existing of board.ships) {
    if (existing.id === ship.id) continue;
    for (const cell of shipCells(existing)) {
      occupied.add(`${cell.x},${cell.y}`);
    }
  }

  for (const cell of cells) {
    if (occupied.has(`${cell.x},${cell.y}`)) {
      return { ok: false, reason: 'ship overlaps another ship' };
    }
  }

  if (NO_SHIP_ADJACENCY) {
    for (const cell of cells) {
      for (const adj of adjacentCells(cell)) {
        if (occupied.has(`${adj.x},${adj.y}`)) {
          return { ok: false, reason: 'ships cannot be adjacent (incl. diagonal)' };
        }
      }
    }
  }

  return { ok: true };
}

export function placeShip(board: Board, ship: Ship): Board {
  return {
    ...board,
    ships: [...board.ships.filter((s) => s.id !== ship.id), ship],
  };
}

export function placeFleet(board: Board, ships: Ship[]): PlacementResult {
  if (ships.length !== FLEET.length) {
    return { ok: false, reason: `fleet must have ${FLEET.length} ships` };
  }

  const expectedByKind = new Map(FLEET.map((s) => [s.kind, s.length]));
  const seenKinds = new Set<string>();

  for (const ship of ships) {
    const expectedLen = expectedByKind.get(ship.kind);
    if (expectedLen === undefined) {
      return { ok: false, reason: `unknown ship kind: ${ship.kind}` };
    }
    if (ship.length !== expectedLen) {
      return { ok: false, reason: `${ship.kind} must have length ${expectedLen}` };
    }
    if (seenKinds.has(ship.kind)) {
      return { ok: false, reason: `duplicate ship kind: ${ship.kind}` };
    }
    seenKinds.add(ship.kind);
  }

  let scratch = emptyBoard(board.size);
  for (const ship of ships) {
    const result = validateShipPlacement(scratch, ship);
    if (!result.ok) return result;
    scratch = placeShip(scratch, ship);
  }

  return { ok: true };
}

export function applyFleet(board: Board, ships: Ship[]): Board {
  return { ...board, ships: ships.map((s) => ({ ...s, hits: [], sunk: false })) };
}
