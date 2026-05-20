import { useEffect, useRef, useCallback } from 'react';
import type {
  Board,
  Coord,
  CreateRoomResult,
  JoinRoomResult,
  PlayerId,
  ReconnectResult,
  RoomCode,
  RoomSnapshot,
  Ship,
  ShotOutcome,
} from '@battleship/shared';
import { getSocket, type AppSocket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { loadCreds, saveCreds, clearCreds } from '../lib/persistence';

type Ack<T> = { ok: true; data: T } | { ok: false; reason: string };

function emit<T>(socket: AppSocket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    (socket as unknown as { emit: (e: string, p: unknown, cb: (r: Ack<T>) => void) => void }).emit(
      event,
      payload,
      (response: Ack<T>) => resolve(response),
    );
  });
}

export function useGameSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const setStatus = useGameStore((s) => s.setStatus);
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setOpponentAiming = useGameStore((s) => s.setOpponentAiming);
  const setOpponentDisconnect = useGameStore((s) => s.setOpponentDisconnect);
  const pushShotEvent = useGameStore((s) => s.pushShotEvent);
  const setFinalBoards = useGameStore((s) => s.setFinalBoards);
  const clearOpponentDisconnect = useGameStore((s) => s.clearOpponentDisconnect);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      const prevStatus = useGameStore.getState().status;
      setStatus('connected');
      if (prevStatus !== 'reconnecting') return;
      const code = useGameStore.getState().roomCode;
      if (!code) return;
      const creds = loadCreds(code);
      if (!creds) return;
      emit<ReconnectResult>(socket, 'room:reconnect', {
        roomCode: code,
        playerId: creds.playerId,
        token: creds.token,
      }).then((res) => {
        if (res.ok) setSnapshot(res.data.snapshot);
        else clearCreds(code);
      });
    };
    const onDisconnect = () => setStatus('reconnecting');
    const onConnectError = (err: Error) => setStatus('error', err.message);
    const onRoomState = (snapshot: RoomSnapshot) => setSnapshot(snapshot);
    const onOpponentAiming = ({ at }: { at: Coord }) => setOpponentAiming(at);
    const onOpponentDisconnected = ({ graceMs }: { graceMs: number }) =>
      setOpponentDisconnect(graceMs);
    const onOpponentReconnected = () => clearOpponentDisconnect();
    const onShotResult = (payload: {
      by: PlayerId;
      at: Coord;
      outcome: ShotOutcome;
      sunkShip?: Ship;
    }) => {
      pushShotEvent(payload);
    };
    const onGameOver = (payload: { winner: PlayerId; boards: Record<PlayerId, Board> }) => {
      setFinalBoards(payload.boards);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:state', onRoomState);
    socket.on('battle:opponentAiming', onOpponentAiming);
    socket.on('battle:shotResult', onShotResult);
    socket.on('battle:gameOver', onGameOver);
    socket.on('connection:opponentDisconnected', onOpponentDisconnected);
    socket.on('connection:opponentReconnected', onOpponentReconnected);

    if (socket.connected) setStatus('connected');
    else setStatus('connecting');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room:state', onRoomState);
      socket.off('battle:opponentAiming', onOpponentAiming);
      socket.off('battle:shotResult', onShotResult);
      socket.off('battle:gameOver', onGameOver);
      socket.off('connection:opponentDisconnected', onOpponentDisconnected);
      socket.off('connection:opponentReconnected', onOpponentReconnected);
    };
  }, [
    setStatus,
    setSnapshot,
    setOpponentAiming,
    setOpponentDisconnect,
    pushShotEvent,
    setFinalBoards,
    clearOpponentDisconnect,
  ]);

  const createRoom = useCallback(
    async (nickname: string): Promise<Ack<CreateRoomResult>> => {
      const socket = socketRef.current ?? getSocket();
      const res = await emit<CreateRoomResult>(socket, 'room:create', { nickname });
      if (res.ok) {
        setIdentity(res.data.roomCode, res.data.playerId, nickname);
        saveCreds({
          roomCode: res.data.roomCode,
          playerId: res.data.playerId,
          token: res.data.token,
          nickname,
        });
        setSnapshot(res.data.snapshot);
      }
      return res;
    },
    [setIdentity, setSnapshot],
  );

  const joinRoom = useCallback(
    async (roomCode: RoomCode, nickname: string): Promise<Ack<JoinRoomResult>> => {
      const socket = socketRef.current ?? getSocket();
      const res = await emit<JoinRoomResult>(socket, 'room:join', { roomCode, nickname });
      if (res.ok) {
        setIdentity(roomCode, res.data.playerId, nickname);
        saveCreds({
          roomCode,
          playerId: res.data.playerId,
          token: res.data.token,
          nickname,
        });
        setSnapshot(res.data.snapshot);
      }
      return res;
    },
    [setIdentity, setSnapshot],
  );

  const reconnectRoom = useCallback(
    async (roomCode: RoomCode): Promise<Ack<ReconnectResult> | null> => {
      const creds = loadCreds(roomCode);
      if (!creds) return null;
      const socket = socketRef.current ?? getSocket();
      const res = await emit<ReconnectResult>(socket, 'room:reconnect', {
        roomCode,
        playerId: creds.playerId,
        token: creds.token,
      });
      if (res.ok) {
        setIdentity(roomCode, creds.playerId, creds.nickname);
        setSnapshot(res.data.snapshot);
      } else {
        clearCreds(roomCode);
      }
      return res;
    },
    [setIdentity, setSnapshot],
  );

  const submitPlacement = useCallback((ships: Ship[]) => {
    const socket = socketRef.current ?? getSocket();
    return emit<void>(socket, 'placement:submit', { ships });
  }, []);

  const markReady = useCallback(() => {
    const socket = socketRef.current ?? getSocket();
    return emit<void>(socket, 'placement:ready', {});
  }, []);

  const sendAim = useCallback((at: Coord) => {
    const socket = socketRef.current ?? getSocket();
    socket.emit('battle:aim', { at });
  }, []);

  const confirmShot = useCallback((at: Coord) => {
    const socket = socketRef.current ?? getSocket();
    return emit<void>(socket, 'battle:confirmShot', { at });
  }, []);

  return {
    createRoom,
    joinRoom,
    reconnectRoom,
    submitPlacement,
    markReady,
    sendAim,
    confirmShot,
  };
}
