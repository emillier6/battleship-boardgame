import { useEffect, useState } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { loadNickname, saveNickname } from '../lib/persistence';
import { ROOM_CODE_LENGTH } from '@battleship/shared';

type Mode = 'choose' | 'create' | 'join';

export default function Lobby() {
  const [mode, setMode] = useState<Mode>('choose');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { createRoom, joinRoom } = useGameSocket();

  useEffect(() => {
    setNickname(loadNickname());
  }, []);

  const persistName = (name: string) => {
    setNickname(name);
    saveNickname(name);
  };

  const handleCreate = async () => {
    setError(null);
    setSubmitting(true);
    const res = await createRoom(nickname || 'Anónimo');
    setSubmitting(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    window.location.href = `/room/${res.data.roomCode}`;
  };

  const handleJoin = async () => {
    setError(null);
    const cleaned = roomCode.trim().toUpperCase();
    if (cleaned.length !== ROOM_CODE_LENGTH) {
      setError(`El código debe tener ${ROOM_CODE_LENGTH} caracteres`);
      return;
    }
    setSubmitting(true);
    const res = await joinRoom(cleaned, nickname || 'Anónimo');
    setSubmitting(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    window.location.href = `/room/${cleaned}`;
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 rounded-xl bg-ocean-700/40 backdrop-blur border border-ocean-500/30 shadow-xl space-y-5">
      <header className="text-center space-y-1">
        <h1 className="text-4xl font-bold tracking-tight">⚓ Battleship</h1>
        <p className="text-ocean-300 text-sm">Hundir la flota — online</p>
      </header>

      <label className="block">
        <span className="text-sm text-ocean-300">Tu nombre</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => persistName(e.target.value)}
          placeholder="Capitán"
          maxLength={20}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-ocean-900/60 border border-ocean-500/40 outline-none focus:ring-2 focus:ring-ocean-300"
        />
      </label>

      {mode === 'choose' && (
        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 py-3 rounded-lg bg-ocean-500 hover:bg-ocean-300 hover:text-ocean-900 font-semibold transition"
            onClick={() => setMode('create')}
          >
            Crear sala
          </button>
          <button
            type="button"
            className="flex-1 py-3 rounded-lg bg-ocean-900 hover:bg-ocean-700 border border-ocean-500/50 font-semibold transition"
            onClick={() => setMode('join')}
          >
            Unirse
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="space-y-3">
          <p className="text-sm text-ocean-300">
            Crearemos una sala y te daremos un código para compartir con tu rival.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-3 rounded-lg bg-ocean-500 hover:bg-ocean-300 hover:text-ocean-900 font-semibold transition disabled:opacity-50"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? 'Creando…' : 'Crear sala'}
            </button>
            <button
              type="button"
              className="px-4 py-3 rounded-lg bg-ocean-900 hover:bg-ocean-700 border border-ocean-500/50 transition"
              onClick={() => setMode('choose')}
            >
              ← Volver
            </button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-ocean-300">Código de sala</span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={ROOM_CODE_LENGTH}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-ocean-900/60 border border-ocean-500/40 outline-none focus:ring-2 focus:ring-ocean-300 tracking-widest text-center text-lg uppercase"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-3 rounded-lg bg-ocean-500 hover:bg-ocean-300 hover:text-ocean-900 font-semibold transition disabled:opacity-50"
              onClick={handleJoin}
              disabled={submitting}
            >
              {submitting ? 'Uniéndose…' : 'Unirse'}
            </button>
            <button
              type="button"
              className="px-4 py-3 rounded-lg bg-ocean-900 hover:bg-ocean-700 border border-ocean-500/50 transition"
              onClick={() => setMode('choose')}
            >
              ← Volver
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-300 bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
