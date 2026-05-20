import { customAlphabet, nanoid } from 'nanoid';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@battleship/shared';

const roomCodeFn = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export function generateRoomCode(): string {
  return roomCodeFn();
}

export function generatePlayerId(): string {
  return nanoid(12);
}

export function generateToken(): string {
  return nanoid(32);
}
