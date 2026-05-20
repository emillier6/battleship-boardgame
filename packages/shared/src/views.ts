import type { Board, OpponentBoardView, Coord } from './types.js';
import { coordEq, shipCells } from './board.js';

export function toOpponentView(board: Board): OpponentBoardView {
  const hitCells = new Set<string>();
  for (const ship of board.ships) {
    for (const cell of shipCells(ship)) {
      hitCells.add(`${cell.x},${cell.y}`);
    }
  }

  const shots: { at: Coord; outcome: 'hit' | 'miss' }[] = board.shotsReceived.map((at) => ({
    at,
    outcome: hitCells.has(`${at.x},${at.y}`) ? 'hit' : 'miss',
  }));

  const sunkShips = board.ships
    .filter((s) => s.sunk)
    .map((s) => ({ ...s, hits: [...s.hits] }));

  return { size: board.size, shots, sunkShips };
}

export function lastShot(board: Board): Coord | null {
  if (board.shotsReceived.length === 0) return null;
  return board.shotsReceived[board.shotsReceived.length - 1]!;
}

export function isCellShot(board: Board, at: Coord): boolean {
  return board.shotsReceived.some((s) => coordEq(s, at));
}
