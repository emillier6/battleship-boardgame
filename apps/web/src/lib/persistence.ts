import type { PlayerId, RoomCode } from '@battleship/shared';

const KEY_PREFIX = 'battleship:room:';

export interface RoomCredentials {
  roomCode: RoomCode;
  playerId: PlayerId;
  token: string;
  nickname: string;
}

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function saveCreds(c: RoomCredentials): void {
  if (!isBrowser) return;
  localStorage.setItem(KEY_PREFIX + c.roomCode, JSON.stringify(c));
}

export function loadCreds(code: RoomCode): RoomCredentials | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(KEY_PREFIX + code);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomCredentials;
  } catch {
    return null;
  }
}

export function clearCreds(code: RoomCode): void {
  if (!isBrowser) return;
  localStorage.removeItem(KEY_PREFIX + code);
}

export function loadNickname(): string {
  if (!isBrowser) return '';
  return localStorage.getItem('battleship:nickname') ?? '';
}

export function saveNickname(name: string): void {
  if (!isBrowser) return;
  localStorage.setItem('battleship:nickname', name);
}
