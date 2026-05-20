import { create } from 'zustand';
import {
  emptyBoard,
  type Board,
  type Coord,
  type OpponentBoardView,
  type Phase,
  type PlayerId,
  type RoomSnapshot,
  type Ship,
  type Shot,
  type ShotOutcome,
} from '@battleship/shared';

export interface ShotEvent {
  id: number;
  by: PlayerId;
  at: Coord;
  outcome: ShotOutcome;
  sunkShip?: Ship;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

interface GameState {
  status: ConnectionStatus;
  errorMessage: string | null;
  roomCode: string | null;
  playerId: PlayerId | null;
  nickname: string;
  phase: Phase;
  myBoard: Board;
  opponentView: OpponentBoardView;
  opponentPresent: boolean;
  opponentNickname: string | null;
  opponentReady: boolean;
  myReady: boolean;
  shotsFired: Shot[];
  currentTurn: PlayerId | null;
  pendingAim: Coord | null;
  opponentAiming: Coord | null;
  winner: PlayerId | null;
  opponentDisconnectDeadline: number | null;
  lastShotEvent: ShotEvent | null;
  finalBoards: Record<PlayerId, Board> | null;
  setStatus(status: ConnectionStatus, errorMessage?: string | null): void;
  setIdentity(roomCode: string, playerId: PlayerId, nickname: string): void;
  setSnapshot(snapshot: RoomSnapshot): void;
  setPendingAim(c: Coord | null): void;
  setOpponentAiming(c: Coord | null): void;
  setOpponentDisconnect(graceMs: number | null): void;
  clearOpponentDisconnect(): void;
  applyLocalPlacement(ships: Ship[]): void;
  pushShotEvent(event: Omit<ShotEvent, 'id'>): void;
  setFinalBoards(boards: Record<PlayerId, Board>): void;
  reset(): void;
}

const initialView: OpponentBoardView = { size: 10, shots: [], sunkShips: [] };

const initialState = {
  status: 'idle' as ConnectionStatus,
  errorMessage: null as string | null,
  roomCode: null as string | null,
  playerId: null as PlayerId | null,
  nickname: '',
  phase: 'LOBBY' as Phase,
  myBoard: emptyBoard(),
  opponentView: initialView,
  opponentPresent: false,
  opponentNickname: null as string | null,
  opponentReady: false,
  myReady: false,
  shotsFired: [] as Shot[],
  currentTurn: null as PlayerId | null,
  pendingAim: null as Coord | null,
  opponentAiming: null as Coord | null,
  winner: null as PlayerId | null,
  opponentDisconnectDeadline: null as number | null,
  lastShotEvent: null as ShotEvent | null,
  finalBoards: null as Record<PlayerId, Board> | null,
};

let shotEventCounter = 0;

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
  setIdentity: (roomCode, playerId, nickname) => set({ roomCode, playerId, nickname }),
  setSnapshot: (s) =>
    set({
      roomCode: s.code,
      phase: s.phase,
      myBoard: s.you.board,
      myReady: s.you.ready,
      shotsFired: s.you.shotsFired,
      opponentView: s.opponent.view,
      opponentPresent: s.opponent.present,
      opponentNickname: s.opponent.nickname,
      opponentReady: s.opponent.ready,
      currentTurn: s.currentTurn,
      winner: s.winner,
    }),
  setPendingAim: (c) => set({ pendingAim: c }),
  setOpponentAiming: (c) => set({ opponentAiming: c }),
  setOpponentDisconnect: (graceMs) =>
    set({
      opponentDisconnectDeadline: graceMs === null ? null : Date.now() + graceMs,
    }),
  clearOpponentDisconnect: () => set({ opponentDisconnectDeadline: null }),
  applyLocalPlacement: (ships) =>
    set((state) => ({
      myBoard: { ...state.myBoard, ships: ships.map((s) => ({ ...s, hits: [], sunk: false })) },
    })),
  pushShotEvent: (event) =>
    set({
      lastShotEvent: { ...event, id: ++shotEventCounter },
      pendingAim: null,
    }),
  setFinalBoards: (boards) => set({ finalBoards: boards }),
  reset: () => set(initialState),
}));
