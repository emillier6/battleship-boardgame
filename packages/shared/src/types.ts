export type Coord = { x: number; y: number };

export type Orientation = 'H' | 'V';

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface Ship {
  id: string;
  kind: ShipKind;
  length: number;
  origin: Coord;
  orientation: Orientation;
  hits: Coord[];
  sunk: boolean;
}

export interface Board {
  size: number;
  ships: Ship[];
  shotsReceived: Coord[];
}

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

export interface Shot {
  by: PlayerId;
  at: Coord;
  outcome: ShotOutcome;
  sunkShipId?: string;
}

export type PlayerId = string;
export type RoomCode = string;

export type Phase = 'LOBBY' | 'PLACEMENT' | 'BATTLE' | 'FINISHED';

export interface PlayerState {
  id: PlayerId;
  nickname: string;
  token: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  board: Board;
  shotsFired: Shot[];
}

export interface RoomState {
  code: RoomCode;
  phase: Phase;
  players: PlayerState[];
  currentTurn: PlayerId | null;
  winner: PlayerId | null;
  createdAt: number;
  disconnectDeadlines: Record<PlayerId, number | null>;
}

export interface OpponentBoardView {
  size: number;
  shots: { at: Coord; outcome: 'hit' | 'miss' }[];
  sunkShips: Ship[];
}

export interface PlacementError {
  ok: false;
  reason: string;
}

export interface PlacementOk {
  ok: true;
}

export type PlacementResult = PlacementOk | PlacementError;
