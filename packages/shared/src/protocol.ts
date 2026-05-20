import type {
  Board,
  Coord,
  OpponentBoardView,
  Phase,
  PlayerId,
  RoomCode,
  Ship,
  Shot,
} from './types.js';

export interface RoomSnapshot {
  code: RoomCode;
  phase: Phase;
  you: {
    id: PlayerId;
    nickname: string;
    board: Board;
    ready: boolean;
    shotsFired: Shot[];
  };
  opponent: {
    id: PlayerId | null;
    nickname: string | null;
    present: boolean;
    ready: boolean;
    view: OpponentBoardView;
  };
  currentTurn: PlayerId | null;
  winner: PlayerId | null;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:playerJoined': (payload: { playerId: PlayerId; nickname: string }) => void;
  'room:phaseChanged': (payload: { phase: Phase }) => void;
  'placement:opponentReady': () => void;
  'battle:turnChanged': (payload: { currentTurn: PlayerId }) => void;
  'battle:opponentAiming': (payload: { at: Coord }) => void;
  'battle:shotResult': (payload: {
    by: PlayerId;
    at: Coord;
    outcome: 'miss' | 'hit' | 'sunk';
    sunkShip?: Ship;
  }) => void;
  'battle:gameOver': (payload: {
    winner: PlayerId;
    boards: Record<PlayerId, Board>;
  }) => void;
  'connection:opponentDisconnected': (payload: { graceMs: number }) => void;
  'connection:opponentReconnected': () => void;
  error: (payload: { code: string; message: string }) => void;
}

export type Ack<T> = (response: { ok: true; data?: T } | { ok: false; reason: string }) => void;

export interface ClientToServerEvents {
  'room:create': (payload: { nickname?: string }, ack: Ack<CreateRoomResult>) => void;
  'room:join': (
    payload: { roomCode: RoomCode; nickname?: string },
    ack: Ack<JoinRoomResult>,
  ) => void;
  'room:reconnect': (
    payload: { roomCode: RoomCode; playerId: PlayerId; token: string },
    ack: Ack<ReconnectResult>,
  ) => void;
  'placement:submit': (payload: { ships: Ship[] }, ack: Ack<void>) => void;
  'placement:ready': (payload: Record<string, never>, ack: Ack<void>) => void;
  'battle:aim': (payload: { at: Coord }) => void;
  'battle:confirmShot': (payload: { at: Coord }, ack: Ack<void>) => void;
}

export interface CreateRoomResult {
  roomCode: RoomCode;
  playerId: PlayerId;
  token: string;
  snapshot: RoomSnapshot;
}

export interface JoinRoomResult {
  playerId: PlayerId;
  token: string;
  snapshot: RoomSnapshot;
}

export interface ReconnectResult {
  snapshot: RoomSnapshot;
}

export interface SocketAuth {
  playerId?: PlayerId;
  token?: string;
  roomCode?: RoomCode;
}
