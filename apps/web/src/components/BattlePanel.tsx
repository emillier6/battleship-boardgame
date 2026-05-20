import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameStore } from '../store/gameStore';
import { BattleScene } from './three/BattleScene';
import { sounds, setMuted, isMuted } from '../lib/sounds';
import { BOARD_SIZE, type Coord } from '@battleship/shared';

function coordLabel(c: Coord): string {
  return `${String.fromCharCode(65 + c.x)}${c.y + 1}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function BattlePanel() {
  const playerId = useGameStore((s) => s.playerId);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const myBoard = useGameStore((s) => s.myBoard);
  const opponentView = useGameStore((s) => s.opponentView);
  const pendingAim = useGameStore((s) => s.pendingAim);
  const setPendingAim = useGameStore((s) => s.setPendingAim);
  const opponentNickname = useGameStore((s) => s.opponentNickname);
  const opponentAiming = useGameStore((s) => s.opponentAiming);
  const lastShotEvent = useGameStore((s) => s.lastShotEvent);

  const { confirmShot, sendAim } = useGameSocket();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(() => isMuted());
  const seenShotId = useRef<number | null>(null);

  const isMyTurn = currentTurn === playerId;

  const myShotKeys = useMemo(
    () => new Set(opponentView.shots.map((s) => `${s.at.x},${s.at.y}`)),
    [opponentView.shots],
  );

  useEffect(() => {
    if (!lastShotEvent) return;
    if (seenShotId.current === lastShotEvent.id) return;
    seenShotId.current = lastShotEvent.id;
    sounds.fire();
    const playLanding = () => {
      if (lastShotEvent.outcome === 'sunk') sounds.sunk();
      else if (lastShotEvent.outcome === 'hit') sounds.hit();
      else sounds.miss();
    };
    const timer = setTimeout(playLanding, 700);
    return () => clearTimeout(timer);
  }, [lastShotEvent]);

  const handleCellClick = useCallback(
    (cell: Coord) => {
      if (!isMyTurn) return;
      if (myShotKeys.has(`${cell.x},${cell.y}`)) return;
      setPendingAim(cell);
      sendAim(cell);
    },
    [isMyTurn, myShotKeys, setPendingAim, sendAim],
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingAim) return;
    setSubmitting(true);
    setError(null);
    const res = await confirmShot(pendingAim);
    setSubmitting(false);
    if (!res.ok) setError(res.reason);
  }, [confirmShot, pendingAim]);

  useEffect(() => {
    if (!isMyTurn) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const start = pendingAim ?? { x: 0, y: 0 };
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      else if (e.key === 'ArrowUp') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (pendingAim && !submitting) handleConfirm();
        return;
      } else return;
      e.preventDefault();
      const next = {
        x: clamp(start.x + dx, 0, BOARD_SIZE - 1),
        y: clamp(start.y + dy, 0, BOARD_SIZE - 1),
      };
      if (myShotKeys.has(`${next.x},${next.y}`)) return;
      setPendingAim(next);
      sendAim(next);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMyTurn, pendingAim, submitting, myShotKeys, handleConfirm, setPendingAim, sendAim]);

  const opponentShotsOnMe = myBoard.shotsReceived;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-ocean-500/30 bg-ocean-900">
        <BattleScene
          myBoard={myBoard}
          opponentShips={opponentView.sunkShips}
          myShotsView={opponentView.shots}
          opponentShotsOnMe={opponentShotsOnMe}
          isMyTurn={isMyTurn}
          pendingAim={pendingAim}
          onCellClick={handleCellClick}
        />

        <div className="absolute top-4 left-4 bg-ocean-700/70 backdrop-blur px-3 py-2 rounded-lg border border-ocean-500/30 text-xs space-y-1 pointer-events-none">
          <div>🎯 Click en tablero rival para apuntar</div>
          <div>⌨️ Flechas para mover · Espacio para confirmar</div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-ocean-900/80 hover:bg-ocean-700 border border-ocean-500/40 text-sm transition"
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {!isMyTurn && opponentAiming && (
          <div className="absolute bottom-4 right-4 bg-amber-900/70 backdrop-blur px-3 py-2 rounded-lg border border-amber-500/30 text-sm pointer-events-none">
            ⏳ Rival apuntando…
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="p-3 bg-ocean-700/40 rounded-lg border border-ocean-500/30 flex items-center justify-between">
          <div>
            <div className="text-xs text-ocean-300 uppercase tracking-wider">Turno</div>
            <div className="font-semibold">
              {isMyTurn ? '🎯 Tu turno' : `⏳ Turno de ${opponentNickname ?? 'rival'}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ocean-300 uppercase tracking-wider">Apuntando</div>
            <div className="font-mono">{pendingAim ? coordLabel(pendingAim) : '—'}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isMyTurn || !pendingAim || submitting}
          className="px-6 py-4 rounded-lg bg-amber-600 hover:bg-amber-400 hover:text-ocean-900 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed text-lg"
        >
          {submitting ? 'Enviando…' : '🔥 Confirmar disparo'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-300 bg-red-900/30 px-3 py-2 rounded">{error}</p>
      )}
    </div>
  );
}
