import type { RoomCode } from '@battleship/shared';
import { Room } from './Room.js';
import { generateRoomCode } from './codes.js';
import { logger } from '../util/logger.js';

const ROOM_TTL_MS = 1000 * 60 * 60;

export class RoomManager {
  private rooms = new Map<RoomCode, Room>();
  private gcInterval: NodeJS.Timeout | null = null;

  create(): Room {
    let code: RoomCode;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));
    const room = new Room(code);
    this.rooms.set(code, room);
    logger.info(`room created: ${code}`);
    return room;
  }

  get(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }

  delete(code: RoomCode): void {
    if (this.rooms.delete(code)) logger.info(`room deleted: ${code}`);
  }

  size(): number {
    return this.rooms.size;
  }

  startGc(intervalMs = 60_000): void {
    if (this.gcInterval) return;
    this.gcInterval = setInterval(() => this.gc(), intervalMs);
  }

  stopGc(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }

  private gc(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const stale =
        room.state.phase === 'FINISHED' && now - room.state.createdAt > ROOM_TTL_MS;
      const noPlayers = room.state.players.length === 0;
      if (stale || noPlayers) this.delete(code);
    }
  }
}
