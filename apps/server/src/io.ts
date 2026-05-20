import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import {
  RECONNECT_GRACE_MS as DEFAULT_RECONNECT_GRACE_MS,
  type ClientToServerEvents,
  type Coord,
  type PlayerId,
  type RoomCode,
  type ServerToClientEvents,
  type Ship,
  type SocketAuth,
} from '@battleship/shared';

const RECONNECT_GRACE_MS = process.env.RECONNECT_GRACE_MS
  ? Number(process.env.RECONNECT_GRACE_MS)
  : DEFAULT_RECONNECT_GRACE_MS;
import { RoomManager } from './rooms/RoomManager.js';
import type { Room } from './rooms/Room.js';
import { logger } from './util/logger.js';

export type ServerIO = IOServer<ClientToServerEvents, ServerToClientEvents>;
export type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface SocketData {
  playerId?: PlayerId;
  roomCode?: RoomCode;
}

interface ForfeitTimer {
  timeout: NodeJS.Timeout;
  playerId: PlayerId;
  roomCode: RoomCode;
}

const forfeitTimers = new Map<string, ForfeitTimer>();

function broadcastRoom(io: ServerIO, room: Room): void {
  for (const player of room.state.players) {
    if (!player.socketId) continue;
    const snapshot = room.snapshotFor(player.id);
    if (snapshot) io.to(player.socketId).emit('room:state', snapshot);
  }
}

function ackErr(reason: string) {
  return { ok: false as const, reason };
}

function ackOk<T>(data?: T) {
  return { ok: true as const, data } as { ok: true; data?: T };
}

function registerHandlers(io: ServerIO, socket: ServerSocket, manager: RoomManager): void {
  socket.on('room:create', ({ nickname }, ack) => {
    const room = manager.create();
    const result = room.addPlayer(nickname ?? '', socket.id);
    if (!result.ok) return ack(ackErr(result.reason));
    const player = result.value;
    socket.data.playerId = player.id;
    socket.data.roomCode = room.state.code;
    socket.join(room.state.code);
    const snapshot = room.snapshotFor(player.id)!;
    ack(
      ackOk({
        roomCode: room.state.code,
        playerId: player.id,
        token: player.token,
        snapshot,
      }),
    );
  });

  socket.on('room:join', ({ roomCode, nickname }, ack) => {
    const room = manager.get(roomCode);
    if (!room) return ack(ackErr('room not found'));
    if (room.isFull()) return ack(ackErr('room is full'));
    const result = room.addPlayer(nickname ?? '', socket.id);
    if (!result.ok) return ack(ackErr(result.reason));
    const player = result.value;
    socket.data.playerId = player.id;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);

    io.to(roomCode).emit('room:playerJoined', { playerId: player.id, nickname: player.nickname });
    io.to(roomCode).emit('room:phaseChanged', { phase: room.state.phase });
    broadcastRoom(io, room);

    const snapshot = room.snapshotFor(player.id)!;
    ack(ackOk({ playerId: player.id, token: player.token, snapshot }));
  });

  socket.on('room:reconnect', ({ roomCode, playerId, token }, ack) => {
    const room = manager.get(roomCode);
    if (!room) return ack(ackErr('room not found'));
    const result = room.reconnect(playerId, token, socket.id);
    if (!result.ok) return ack(ackErr(result.reason));

    socket.data.playerId = playerId;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);

    const timerKey = `${roomCode}:${playerId}`;
    const timer = forfeitTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer.timeout);
      forfeitTimers.delete(timerKey);
    }

    io.to(roomCode).except(socket.id).emit('connection:opponentReconnected');
    const snapshot = room.snapshotFor(playerId)!;
    broadcastRoom(io, room);
    ack(ackOk({ snapshot }));
  });

  socket.on('placement:submit', ({ ships }, ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return ack(ackErr('not in a room'));
    const room = manager.get(roomCode);
    if (!room) return ack(ackErr('room not found'));
    const result = room.submitPlacement(playerId, ships as Ship[]);
    if (!result.ok) return ack(ackErr(result.reason));
    broadcastRoom(io, room);
    ack(ackOk());
  });

  socket.on('placement:ready', (_payload, ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return ack(ackErr('not in a room'));
    const room = manager.get(roomCode);
    if (!room) return ack(ackErr('room not found'));
    const result = room.markReady(playerId);
    if (!result.ok) return ack(ackErr(result.reason));

    const opponent = room.getOpponent(playerId);
    if (opponent?.socketId) {
      io.to(opponent.socketId).emit('placement:opponentReady');
    }

    if (result.value.bothReady) {
      io.to(roomCode).emit('room:phaseChanged', { phase: 'BATTLE' });
      io.to(roomCode).emit('battle:turnChanged', { currentTurn: room.state.currentTurn! });
    }
    broadcastRoom(io, room);
    ack(ackOk());
  });

  socket.on('battle:aim', ({ at }: { at: Coord }) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return;
    const room = manager.get(roomCode);
    if (!room) return;
    if (room.state.phase !== 'BATTLE') return;
    if (room.state.currentTurn !== playerId) return;
    const opponent = room.getOpponent(playerId);
    if (opponent?.socketId) io.to(opponent.socketId).emit('battle:opponentAiming', { at });
  });

  socket.on('battle:confirmShot', ({ at }, ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return ack(ackErr('not in a room'));
    const room = manager.get(roomCode);
    if (!room) return ack(ackErr('room not found'));
    const result = room.confirmShot(playerId, at);
    if (!result.ok) return ack(ackErr(result.reason));

    io.to(roomCode).emit('battle:shotResult', {
      by: playerId,
      at,
      outcome: result.value.outcome,
      sunkShip: result.value.sunkShip,
    });

    if (result.value.gameOver) {
      for (const player of room.state.players) {
        const timerKey = `${roomCode}:${player.id}`;
        const t = forfeitTimers.get(timerKey);
        if (t) {
          clearTimeout(t.timeout);
          forfeitTimers.delete(timerKey);
        }
      }
      io.to(roomCode).emit('battle:gameOver', {
        winner: playerId,
        boards: room.allBoardsForGameOver(),
      });
      io.to(roomCode).emit('room:phaseChanged', { phase: 'FINISHED' });
    } else if (result.value.nextTurn) {
      io.to(roomCode).emit('battle:turnChanged', { currentTurn: result.value.nextTurn });
    }

    broadcastRoom(io, room);
    ack(ackOk());
  });

  socket.on('disconnect', () => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return;
    const room = manager.get(roomCode);
    if (!room) return;
    const player = room.getPlayer(playerId);
    if (!player) return;
    if (player.socketId !== socket.id) return;

    const disconnectInfo = room.markDisconnected(playerId);
    if (!disconnectInfo) return;

    io.to(roomCode).except(socket.id).emit('connection:opponentDisconnected', {
      graceMs: RECONNECT_GRACE_MS,
    });

    if (room.state.phase === 'BATTLE' || room.state.phase === 'PLACEMENT') {
      const timerKey = `${roomCode}:${playerId}`;
      const timeout = setTimeout(() => {
        const currentRoom = manager.get(roomCode);
        if (!currentRoom) return;
        const p = currentRoom.getPlayer(playerId);
        if (!p || p.connected) return;
        currentRoom.forfeit(playerId);
        if (currentRoom.state.winner) {
          io.to(roomCode).emit('battle:gameOver', {
            winner: currentRoom.state.winner,
            boards: currentRoom.allBoardsForGameOver(),
          });
          io.to(roomCode).emit('room:phaseChanged', { phase: 'FINISHED' });
        }
        forfeitTimers.delete(timerKey);
      }, RECONNECT_GRACE_MS);
      forfeitTimers.set(timerKey, { timeout, playerId, roomCode });
    }
  });
}

export function attachSocketServer(
  httpServer: HttpServer,
  opts: { origin: string; manager?: RoomManager },
): { io: ServerIO; manager: RoomManager } {
  const manager = opts.manager ?? new RoomManager();
  manager.startGc();

  const io: ServerIO = new IOServer(httpServer, {
    cors: { origin: opts.origin, credentials: true },
  });

  io.on('connection', (socket) => {
    logger.debug(`socket connected: ${socket.id}`);
    registerHandlers(io, socket as ServerSocket, manager);
  });

  return { io, manager };
}

export function clearForfeitTimers(): void {
  for (const t of forfeitTimers.values()) clearTimeout(t.timeout);
  forfeitTimers.clear();
}
