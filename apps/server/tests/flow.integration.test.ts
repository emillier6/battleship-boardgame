import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { attachSocketServer, clearForfeitTimers, type ServerIO } from '../src/io.js';
import { RoomManager } from '../src/rooms/RoomManager.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Ship,
  RoomSnapshot,
} from '@battleship/shared';

type AnyClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function emitWithAck<TRes>(socket: AnyClient, event: string, payload: unknown): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 3000);
    (socket as unknown as { emit: (e: string, p: unknown, cb: (r: TRes) => void) => void }).emit(
      event,
      payload,
      (res: TRes) => {
        clearTimeout(t);
        resolve(res);
      },
    );
  });
}

function waitFor<TPayload = unknown>(socket: AnyClient, event: string): Promise<TPayload> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${event}`)), 3000);
    (socket as unknown as { once: (e: string, cb: (p: TPayload) => void) => void }).once(
      event,
      (payload: TPayload) => {
        clearTimeout(t);
        resolve(payload);
      },
    );
  });
}

const validFleet = (): Ship[] => [
  { id: 'carrier', kind: 'carrier', length: 5, origin: { x: 0, y: 0 }, orientation: 'H', hits: [], sunk: false },
  { id: 'battleship', kind: 'battleship', length: 4, origin: { x: 0, y: 2 }, orientation: 'H', hits: [], sunk: false },
  { id: 'cruiser', kind: 'cruiser', length: 3, origin: { x: 0, y: 4 }, orientation: 'H', hits: [], sunk: false },
  { id: 'submarine', kind: 'submarine', length: 3, origin: { x: 0, y: 6 }, orientation: 'H', hits: [], sunk: false },
  { id: 'destroyer', kind: 'destroyer', length: 2, origin: { x: 0, y: 8 }, orientation: 'H', hits: [], sunk: false },
];

describe('socket flow integration', () => {
  let httpServer: HttpServer;
  let io: ServerIO;
  let manager: RoomManager;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    manager = new RoomManager();
    const attached = attachSocketServer(httpServer, { origin: '*', manager });
    io = attached.io;
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    manager.stopGc();
    clearForfeitTimers();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('two clients can play a full game to completion', async () => {
    const a = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    const b = createClient(`http://localhost:${port}`, { transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((r) => a.on('connect', () => r())),
      new Promise<void>((r) => b.on('connect', () => r())),
    ]);

    const createRes = await emitWithAck<{
      ok: true;
      data: { roomCode: string; playerId: string; token: string; snapshot: RoomSnapshot };
    }>(a, 'room:create', { nickname: 'Alice' });
    expect(createRes.ok).toBe(true);
    const roomCode = createRes.data.roomCode;
    const aId = createRes.data.playerId;

    const joinRes = await emitWithAck<{
      ok: true;
      data: { playerId: string; token: string; snapshot: RoomSnapshot };
    }>(b, 'room:join', { roomCode, nickname: 'Bob' });
    expect(joinRes.ok).toBe(true);
    const bId = joinRes.data.playerId;

    expect(joinRes.data.snapshot.phase).toBe('PLACEMENT');

    const aSub = await emitWithAck<{ ok: true }>(a, 'placement:submit', { ships: validFleet() });
    const bSub = await emitWithAck<{ ok: true }>(b, 'placement:submit', { ships: validFleet() });
    expect(aSub.ok).toBe(true);
    expect(bSub.ok).toBe(true);

    const aReady = await emitWithAck<{ ok: true }>(a, 'placement:ready', {});
    expect(aReady.ok).toBe(true);
    const phaseChangedPromise = waitFor<{ phase: string }>(a, 'room:phaseChanged');
    const bReady = await emitWithAck<{ ok: true }>(b, 'placement:ready', {});
    expect(bReady.ok).toBe(true);
    const phaseChanged = await phaseChangedPromise;
    expect(phaseChanged.phase).toBe('BATTLE');

    const targetCells: { x: number; y: number }[] = [];
    for (const ship of validFleet()) {
      for (let i = 0; i < ship.length; i++) {
        targetCells.push({
          x: ship.origin.x + (ship.orientation === 'H' ? i : 0),
          y: ship.origin.y + (ship.orientation === 'V' ? i : 0),
        });
      }
    }

    let gameOverPayload: { winner: string } | null = null;
    a.on('battle:gameOver', (p) => {
      gameOverPayload = p as { winner: string };
    });

    const bMissCells: { x: number; y: number }[] = [];
    for (const y of [1, 3, 5, 7, 9]) {
      for (let x = 0; x < 10; x++) bMissCells.push({ x, y });
    }

    let aIdx = 0;
    let bIdx = 0;
    let isATurn = true;
    let safety = 0;
    while (!gameOverPayload && safety < 60) {
      if (isATurn) {
        const r = await emitWithAck<{ ok: boolean }>(a, 'battle:confirmShot', {
          at: targetCells[aIdx]!,
        });
        expect(r.ok).toBe(true);
        aIdx++;
      } else {
        const r = await emitWithAck<{ ok: boolean }>(b, 'battle:confirmShot', {
          at: bMissCells[bIdx]!,
        });
        expect(r.ok).toBe(true);
        bIdx++;
      }
      isATurn = !isATurn;
      safety++;
      await new Promise((res) => setTimeout(res, 10));
    }

    expect(gameOverPayload).not.toBeNull();
    expect((gameOverPayload as unknown as { winner: string }).winner).toBe(aId);
    expect(bId).toBeDefined();

    a.disconnect();
    b.disconnect();
  });

  it('reconnect restores state with valid token', async () => {
    const a = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => a.on('connect', () => r()));

    const createRes = await emitWithAck<{
      ok: true;
      data: { roomCode: string; playerId: string; token: string };
    }>(a, 'room:create', {});
    expect(createRes.ok).toBe(true);
    const { roomCode, playerId, token } = createRes.data;
    a.disconnect();

    const a2 = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => a2.on('connect', () => r()));
    const recon = await emitWithAck<{ ok: true; data: { snapshot: RoomSnapshot } }>(
      a2,
      'room:reconnect',
      { roomCode, playerId, token },
    );
    expect(recon.ok).toBe(true);
    expect(recon.data.snapshot.you.id).toBe(playerId);
    a2.disconnect();
  });

  it('reconnect rejects invalid token', async () => {
    const a = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => a.on('connect', () => r()));
    const createRes = await emitWithAck<{
      ok: true;
      data: { roomCode: string; playerId: string; token: string };
    }>(a, 'room:create', {});
    const { roomCode, playerId } = createRes.data;
    a.disconnect();

    const a2 = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => a2.on('connect', () => r()));
    const recon = await emitWithAck<{ ok: boolean; reason?: string }>(a2, 'room:reconnect', {
      roomCode,
      playerId,
      token: 'invalid-token',
    });
    expect(recon.ok).toBe(false);
    a2.disconnect();
  });

  it('rejects joining a non-existent room', async () => {
    const a = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => a.on('connect', () => r()));
    const r = await emitWithAck<{ ok: boolean; reason?: string }>(a, 'room:join', {
      roomCode: 'NOPE99',
    });
    expect(r.ok).toBe(false);
    a.disconnect();
  });
});
