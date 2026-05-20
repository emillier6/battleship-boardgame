import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
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

function waitFor<TPayload = unknown>(socket: AnyClient, event: string, timeoutMs = 3000): Promise<TPayload> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${event}`)), timeoutMs);
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

describe('forfeit on disconnect timeout', () => {
  let httpServer: HttpServer;
  let manager: import('../src/rooms/RoomManager.js').RoomManager;
  let cleanup: () => void;
  let port: number;

  beforeAll(() => {
    process.env.RECONNECT_GRACE_MS = '500';
  });

  afterAll(() => {
    delete process.env.RECONNECT_GRACE_MS;
  });

  beforeEach(async () => {
    const { attachSocketServer, clearForfeitTimers } = await import('../src/io.js');
    const { RoomManager } = await import('../src/rooms/RoomManager.js');
    httpServer = createServer();
    manager = new RoomManager();
    const attached = attachSocketServer(httpServer, { origin: '*', manager });
    cleanup = () => {
      manager.stopGc();
      clearForfeitTimers();
      attached.io.close();
    };
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('opponent receives gameOver when disconnected player does not reconnect in time', async () => {
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
    const roomCode = createRes.data.roomCode;
    const joinRes = await emitWithAck<{
      ok: true;
      data: { playerId: string; token: string; snapshot: RoomSnapshot };
    }>(b, 'room:join', { roomCode, nickname: 'Bob' });
    const bId = joinRes.data.playerId;

    await emitWithAck(a, 'placement:submit', { ships: validFleet() });
    await emitWithAck(b, 'placement:submit', { ships: validFleet() });
    await emitWithAck(a, 'placement:ready', {});
    await emitWithAck(b, 'placement:ready', {});

    const disconnectPromise = waitFor<{ graceMs: number }>(
      a,
      'connection:opponentDisconnected',
      3000,
    );
    const gameOverPromise = waitFor<{ winner: string }>(a, 'battle:gameOver', 3000);

    b.disconnect();

    const disconnectMsg = await disconnectPromise;
    expect(disconnectMsg.graceMs).toBe(500);

    const gameOver = await gameOverPromise;
    expect(gameOver.winner).not.toBe(bId);

    a.disconnect();
  });

  it('reconnection within grace period cancels forfeit', async () => {
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
    const roomCode = createRes.data.roomCode;
    const joinRes = await emitWithAck<{
      ok: true;
      data: { playerId: string; token: string; snapshot: RoomSnapshot };
    }>(b, 'room:join', { roomCode, nickname: 'Bob' });
    const bId = joinRes.data.playerId;
    const bToken = joinRes.data.token;

    await emitWithAck(a, 'placement:submit', { ships: validFleet() });
    await emitWithAck(b, 'placement:submit', { ships: validFleet() });
    await emitWithAck(a, 'placement:ready', {});
    await emitWithAck(b, 'placement:ready', {});

    const reconnectedPromise = waitFor(a, 'connection:opponentReconnected', 3000);
    b.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    const b2 = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((r) => b2.on('connect', () => r()));
    const recon = await emitWithAck<{ ok: true; data: { snapshot: RoomSnapshot } }>(
      b2,
      'room:reconnect',
      { roomCode, playerId: bId, token: bToken },
    );
    expect(recon.ok).toBe(true);
    await reconnectedPromise;

    let gameOverFired = false;
    a.once('battle:gameOver', () => {
      gameOverFired = true;
    });
    await new Promise((r) => setTimeout(r, 800));
    expect(gameOverFired).toBe(false);

    a.disconnect();
    b2.disconnect();
  });
});
