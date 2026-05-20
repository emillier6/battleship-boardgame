import {
  applyShot,
  emptyBoard,
  isGameOver,
  nextTurn,
  placeFleet,
  applyFleet,
  toOpponentView,
  RECONNECT_GRACE_MS,
  type Board,
  type Coord,
  type PlayerId,
  type PlayerState,
  type RoomCode,
  type RoomSnapshot,
  type RoomState,
  type Ship,
  type ShotOutcome,
} from '@battleship/shared';
import { generatePlayerId, generateToken } from './codes.js';

export interface OkResult<T = undefined> {
  ok: true;
  value: T;
}
export interface ErrResult {
  ok: false;
  reason: string;
}
export type Result<T = undefined> = OkResult<T> | ErrResult;

const ok = <T>(value: T): OkResult<T> => ({ ok: true, value });
const err = (reason: string): ErrResult => ({ ok: false, reason });

export class Room {
  state: RoomState;

  constructor(code: RoomCode) {
    this.state = {
      code,
      phase: 'LOBBY',
      players: [],
      currentTurn: null,
      winner: null,
      createdAt: Date.now(),
      disconnectDeadlines: {},
    };
  }

  isFull(): boolean {
    return this.state.players.length >= 2;
  }

  addPlayer(nickname: string, socketId: string): Result<PlayerState> {
    if (this.isFull()) return err('room is full');
    const player: PlayerState = {
      id: generatePlayerId(),
      nickname: nickname || `Player${this.state.players.length + 1}`,
      token: generateToken(),
      socketId,
      connected: true,
      ready: false,
      board: emptyBoard(),
      shotsFired: [],
    };
    this.state.players.push(player);
    if (this.state.players.length === 2) {
      this.state.phase = 'PLACEMENT';
    }
    return ok(player);
  }

  getPlayer(playerId: PlayerId): PlayerState | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  getOpponent(playerId: PlayerId): PlayerState | undefined {
    return this.state.players.find((p) => p.id !== playerId);
  }

  submitPlacement(playerId: PlayerId, ships: Ship[]): Result {
    if (this.state.phase !== 'PLACEMENT') return err('not in PLACEMENT phase');
    const player = this.getPlayer(playerId);
    if (!player) return err('player not in room');

    const placement = placeFleet(emptyBoard(), ships);
    if (!placement.ok) return err(placement.reason);

    player.board = applyFleet(emptyBoard(), ships);
    player.ready = false;
    return ok(undefined);
  }

  markReady(playerId: PlayerId): Result<{ bothReady: boolean }> {
    if (this.state.phase !== 'PLACEMENT') return err('not in PLACEMENT phase');
    const player = this.getPlayer(playerId);
    if (!player) return err('player not in room');
    if (player.board.ships.length === 0) return err('must submit placement first');
    player.ready = true;

    const bothReady = this.state.players.length === 2 && this.state.players.every((p) => p.ready);
    if (bothReady) {
      this.state.phase = 'BATTLE';
      this.state.currentTurn = this.state.players[0]!.id;
    }
    return ok({ bothReady });
  }

  confirmShot(
    playerId: PlayerId,
    at: Coord,
  ): Result<{ outcome: ShotOutcome; sunkShip?: Ship; gameOver: boolean; nextTurn: PlayerId | null }> {
    if (this.state.phase !== 'BATTLE') return err('not in BATTLE phase');
    if (this.state.currentTurn !== playerId) return err('not your turn');
    const opponent = this.getOpponent(playerId);
    if (!opponent) return err('no opponent');

    const shotResult = applyShot(opponent.board, at);
    if ('ok' in shotResult && shotResult.ok === false) {
      return err(shotResult.reason);
    }
    if (!('board' in shotResult)) return err('shot failed');

    opponent.board = shotResult.board;
    const player = this.getPlayer(playerId)!;
    player.shotsFired.push({
      by: playerId,
      at,
      outcome: shotResult.outcome,
      sunkShipId: shotResult.sunkShipId,
    });

    let sunkShip: Ship | undefined;
    if (shotResult.outcome === 'sunk' && shotResult.sunkShipId) {
      sunkShip = opponent.board.ships.find((s) => s.id === shotResult.sunkShipId);
    }

    const gameOver = isGameOver(opponent.board);
    let nextTurnId: PlayerId | null = null;
    if (gameOver) {
      this.state.phase = 'FINISHED';
      this.state.winner = playerId;
      this.state.currentTurn = null;
    } else {
      nextTurnId = nextTurn(this.state, shotResult.outcome);
      this.state.currentTurn = nextTurnId;
    }

    return ok({ outcome: shotResult.outcome, sunkShip, gameOver, nextTurn: nextTurnId });
  }

  markDisconnected(playerId: PlayerId): { graceMs: number } | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    player.connected = false;
    player.socketId = null;
    const deadline = Date.now() + RECONNECT_GRACE_MS;
    this.state.disconnectDeadlines[playerId] = deadline;
    return { graceMs: RECONNECT_GRACE_MS };
  }

  reconnect(playerId: PlayerId, token: string, socketId: string): Result<PlayerState> {
    const player = this.getPlayer(playerId);
    if (!player) return err('player not found');
    if (player.token !== token) return err('invalid token');
    player.connected = true;
    player.socketId = socketId;
    this.state.disconnectDeadlines[playerId] = null;
    return ok(player);
  }

  forfeit(playerId: PlayerId): void {
    const opponent = this.getOpponent(playerId);
    if (!opponent) return;
    this.state.phase = 'FINISHED';
    this.state.winner = opponent.id;
    this.state.currentTurn = null;
  }

  snapshotFor(playerId: PlayerId): RoomSnapshot | null {
    const you = this.getPlayer(playerId);
    if (!you) return null;
    const opp = this.getOpponent(playerId);

    return {
      code: this.state.code,
      phase: this.state.phase,
      you: {
        id: you.id,
        nickname: you.nickname,
        board: you.board,
        ready: you.ready,
        shotsFired: you.shotsFired,
      },
      opponent: {
        id: opp?.id ?? null,
        nickname: opp?.nickname ?? null,
        present: Boolean(opp?.connected),
        ready: opp?.ready ?? false,
        view: opp ? toOpponentView(opp.board) : { size: emptyBoard().size, shots: [], sunkShips: [] },
      },
      currentTurn: this.state.currentTurn,
      winner: this.state.winner,
    };
  }

  allBoardsForGameOver(): Record<PlayerId, Board> {
    const out: Record<PlayerId, Board> = {};
    for (const p of this.state.players) out[p.id] = p.board;
    return out;
  }
}
