import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketAuth,
} from '@battleship/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

let socket: AppSocket | null = null;

export function getSocket(auth?: SocketAuth): AppSocket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    auth: auth as Record<string, unknown>,
  }) as AppSocket;

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
