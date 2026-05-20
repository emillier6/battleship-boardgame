import { useEffect, useState } from 'react';
import { ConnectionBanner } from './ConnectionBanner';
import { PlacementPanel } from './PlacementPanel';
import { BattlePanel } from './BattlePanel';
import { GameOverModal } from './GameOverModal';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameStore } from '../store/gameStore';
import { loadCreds } from '../lib/persistence';
import { ROOM_CODE_LENGTH } from '@battleship/shared';

interface Props {
  code: string;
}

type BootstrapState =
  | { kind: 'loading' }
  | { kind: 'needsJoin' }
  | { kind: 'inRoom' }
  | { kind: 'error'; reason: string };

export default function GameRoom({ code }: Props) {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ kind: 'loading' });
  const [nicknameInput, setNicknameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { reconnectRoom, joinRoom } = useGameSocket();

  const roomCode = useGameStore((s) => s.roomCode);
  const phase = useGameStore((s) => s.phase);
  const opponentNickname = useGameStore((s) => s.opponentNickname);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const playerId = useGameStore((s) => s.playerId);

  useEffect(() => {
    if (code.length !== ROOM_CODE_LENGTH) {
      setBootstrap({ kind: 'error', reason: 'Código de sala inválido' });
      return;
    }
    const creds = loadCreds(code);
    if (!creds) {
      setBootstrap({ kind: 'needsJoin' });
      return;
    }
    reconnectRoom(code).then((res) => {
      if (!res) {
        setBootstrap({ kind: 'needsJoin' });
      } else if (res.ok) {
        setBootstrap({ kind: 'inRoom' });
      } else {
        setBootstrap({ kind: 'needsJoin' });
      }
    });
  }, [code, reconnectRoom]);

  const handleJoin = async () => {
    setSubmitting(true);
    const res = await joinRoom(code, nicknameInput || 'Anónimo');
    setSubmitting(false);
    if (res.ok) setBootstrap({ kind: 'inRoom' });
    else setBootstrap({ kind: 'error', reason: res.reason });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* noop */
    }
  };

  if (bootstrap.kind === 'loading') {
    return <div className="p-8 text-center">Cargando sala {code}…</div>;
  }

  if (bootstrap.kind === 'error') {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-red-300">{bootstrap.reason}</p>
        <a href="/" className="underline text-ocean-300">
          Volver al inicio
        </a>
      </div>
    );
  }

  if (bootstrap.kind === 'needsJoin') {
    return (
      <div className="max-w-md mx-auto p-6 rounded-xl bg-ocean-700/40 border border-ocean-500/30 space-y-4">
        <header>
          <h2 className="text-2xl font-bold">Unirse a la sala</h2>
          <p className="text-ocean-300 text-sm">
            Código: <span className="font-mono">{code}</span>
          </p>
        </header>
        <label className="block">
          <span className="text-sm text-ocean-300">Tu nombre</span>
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="Capitán"
            maxLength={20}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-ocean-900/60 border border-ocean-500/40 outline-none focus:ring-2 focus:ring-ocean-300"
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
          <a
            href="/"
            className="px-4 py-3 rounded-lg bg-ocean-900 hover:bg-ocean-700 border border-ocean-500/50 transition"
          >
            ← Cancelar
          </a>
        </div>
      </div>
    );
  }

  const isMyTurn = currentTurn === playerId;

  return (
    <div className="space-y-4">
      <ConnectionBanner />

      <header className="flex items-center justify-between gap-4 px-4 py-3 bg-ocean-700/40 rounded-xl border border-ocean-500/30">
        <div>
          <div className="text-xs text-ocean-300 uppercase tracking-wider">Sala</div>
          <div className="font-mono text-2xl tracking-widest">{roomCode}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-ocean-300 uppercase tracking-wider">Fase</div>
          <div className="font-semibold">{phase}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-ocean-300 uppercase tracking-wider">Turno</div>
          <div className="font-semibold">
            {phase === 'BATTLE'
              ? isMyTurn
                ? 'Tu turno'
                : `Turno de ${opponentNickname ?? 'rival'}`
              : '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="px-3 py-2 rounded-lg bg-ocean-900 hover:bg-ocean-500 border border-ocean-500/50 transition text-sm"
        >
          Copiar código
        </button>
      </header>

      {phase === 'PLACEMENT' && <PlacementPanel />}

      {(phase === 'BATTLE' || phase === 'FINISHED') && <BattlePanel />}

      {phase === 'LOBBY' && (
        <section className="p-4 bg-ocean-700/40 rounded-xl border border-ocean-500/30 text-center">
          <p className="text-ocean-300">
            Esperando rival… Comparte el código <span className="font-mono">{roomCode}</span> con
            alguien para empezar.
          </p>
        </section>
      )}

      {phase === 'FINISHED' && <GameOverModal />}
    </div>
  );
}
