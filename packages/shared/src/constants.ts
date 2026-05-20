import type { ShipKind } from './types.js';

export const BOARD_SIZE = 10;

export const FLEET: { kind: ShipKind; length: number }[] = [
  { kind: 'carrier', length: 5 },
  { kind: 'battleship', length: 4 },
  { kind: 'cruiser', length: 3 },
  { kind: 'submarine', length: 3 },
  { kind: 'destroyer', length: 2 },
];

export const FLEET_SIZE = FLEET.length;

export const RECONNECT_GRACE_MS = 60_000;

export const NO_SHIP_ADJACENCY = true;

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
