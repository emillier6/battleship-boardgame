import { describe, it, expect } from 'vitest';
import { Room } from '../src/rooms/Room.js';
import { RoomManager } from '../src/rooms/RoomManager.js';
import type { Ship } from '@battleship/shared';

const validFleet = (): Ship[] => [
  { id: 'carrier', kind: 'carrier', length: 5, origin: { x: 0, y: 0 }, orientation: 'H', hits: [], sunk: false },
  { id: 'battleship', kind: 'battleship', length: 4, origin: { x: 0, y: 2 }, orientation: 'H', hits: [], sunk: false },
  { id: 'cruiser', kind: 'cruiser', length: 3, origin: { x: 0, y: 4 }, orientation: 'H', hits: [], sunk: false },
  { id: 'submarine', kind: 'submarine', length: 3, origin: { x: 0, y: 6 }, orientation: 'H', hits: [], sunk: false },
  { id: 'destroyer', kind: 'destroyer', length: 2, origin: { x: 0, y: 8 }, orientation: 'H', hits: [], sunk: false },
];

describe('RoomManager', () => {
  it('creates rooms with unique codes', () => {
    const m = new RoomManager();
    const r1 = m.create();
    const r2 = m.create();
    expect(r1.state.code).not.toBe(r2.state.code);
    expect(m.size()).toBe(2);
  });

  it('deletes rooms', () => {
    const m = new RoomManager();
    const r = m.create();
    m.delete(r.state.code);
    expect(m.get(r.state.code)).toBeUndefined();
  });
});

describe('Room flow', () => {
  it('transitions LOBBY → PLACEMENT when 2 players join', () => {
    const room = new Room('ABC123');
    expect(room.state.phase).toBe('LOBBY');
    const a = room.addPlayer('A', 'sa');
    expect(a.ok).toBe(true);
    expect(room.state.phase).toBe('LOBBY');
    const b = room.addPlayer('B', 'sb');
    expect(b.ok).toBe(true);
    expect(room.state.phase).toBe('PLACEMENT');
  });

  it('rejects third player', () => {
    const room = new Room('ABC123');
    room.addPlayer('A', 'sa');
    room.addPlayer('B', 'sb');
    const c = room.addPlayer('C', 'sc');
    expect(c.ok).toBe(false);
  });

  it('transitions PLACEMENT → BATTLE when both ready', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    expect(room.submitPlacement(a.id, validFleet()).ok).toBe(true);
    expect(room.submitPlacement(b.id, validFleet()).ok).toBe(true);
    expect(room.markReady(a.id).ok).toBe(true);
    expect(room.state.phase).toBe('PLACEMENT');
    expect(room.markReady(b.id).ok).toBe(true);
    expect(room.state.phase).toBe('BATTLE');
    expect(room.state.currentTurn).toBe(a.id);
  });

  it('rejects shot when not your turn', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    room.submitPlacement(a.id, validFleet());
    room.submitPlacement(b.id, validFleet());
    room.markReady(a.id);
    room.markReady(b.id);
    expect(room.confirmShot(b.id, { x: 0, y: 0 }).ok).toBe(false);
  });

  it('switches turn after a shot', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    room.submitPlacement(a.id, validFleet());
    room.submitPlacement(b.id, validFleet());
    room.markReady(a.id);
    room.markReady(b.id);
    const shot = room.confirmShot(a.id, { x: 9, y: 9 });
    expect(shot.ok).toBe(true);
    expect(room.state.currentTurn).toBe(b.id);
  });

  it('detects gameOver when all opponent ships are sunk', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    room.submitPlacement(a.id, validFleet());
    room.submitPlacement(b.id, validFleet());
    room.markReady(a.id);
    room.markReady(b.id);

    const targetCells: { x: number; y: number }[] = [];
    for (const ship of validFleet()) {
      for (let i = 0; i < ship.length; i++) {
        targetCells.push({
          x: ship.origin.x + (ship.orientation === 'H' ? i : 0),
          y: ship.origin.y + (ship.orientation === 'V' ? i : 0),
        });
      }
    }

    const bMissCells: { x: number; y: number }[] = [];
    for (const y of [1, 3, 5, 7, 9]) {
      for (let x = 0; x < 10; x++) bMissCells.push({ x, y });
    }

    let turn: 'a' | 'b' = 'a';
    let aIdx = 0;
    let bIdx = 0;
    while (room.state.phase === 'BATTLE') {
      if (turn === 'a') {
        const at = targetCells[aIdx]!;
        aIdx++;
        const r = room.confirmShot(a.id, at);
        expect(r.ok).toBe(true);
      } else {
        const r = room.confirmShot(b.id, bMissCells[bIdx]!);
        bIdx++;
        expect(r.ok).toBe(true);
      }
      turn = turn === 'a' ? 'b' : 'a';
    }

    expect(room.state.phase).toBe('FINISHED');
    expect(room.state.winner).toBe(a.id);
  });

  it('rejects placement during BATTLE phase', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    room.submitPlacement(a.id, validFleet());
    room.submitPlacement(b.id, validFleet());
    room.markReady(a.id);
    room.markReady(b.id);
    expect(room.submitPlacement(a.id, validFleet()).ok).toBe(false);
  });

  it('reconnect requires valid token', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    if (!aRes.ok) throw new Error('setup');
    const a = aRes.value;
    room.markDisconnected(a.id);
    expect(room.reconnect(a.id, 'wrong', 'sa2').ok).toBe(false);
    expect(room.reconnect(a.id, a.token, 'sa2').ok).toBe(true);
  });

  it('snapshot hides opponent ships', () => {
    const room = new Room('ABC123');
    const aRes = room.addPlayer('A', 'sa');
    const bRes = room.addPlayer('B', 'sb');
    if (!aRes.ok || !bRes.ok) throw new Error('setup');
    const a = aRes.value;
    const b = bRes.value;
    room.submitPlacement(b.id, validFleet());
    const snap = room.snapshotFor(a.id)!;
    expect(snap.opponent.view.sunkShips).toEqual([]);
    expect(snap.you.board.ships).toEqual([]);
  });
});
