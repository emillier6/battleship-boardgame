import { useState, useCallback } from 'react';
import { FLEET, type Ship } from '@battleship/shared';
import { PlacementScene } from './three/PlacementScene';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameStore } from '../store/gameStore';

export function PlacementPanel() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [allValid, setAllValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myReady = useGameStore((s) => s.myReady);
  const opponentReady = useGameStore((s) => s.opponentReady);
  const opponentPresent = useGameStore((s) => s.opponentPresent);
  const opponentNickname = useGameStore((s) => s.opponentNickname);

  const { submitPlacement, markReady } = useGameSocket();

  const handleReady = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    const submit = await submitPlacement(ships);
    if (!submit.ok) {
      setError(submit.reason);
      setSubmitting(false);
      return;
    }
    const ready = await markReady();
    setSubmitting(false);
    if (!ready.ok) {
      setError(ready.reason);
    }
  }, [submitPlacement, markReady, ships]);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-ocean-500/30 bg-ocean-900">
        <PlacementScene onShipsChange={setShips} onAllValidChange={setAllValid} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 bg-ocean-700/40 rounded-lg border border-ocean-500/30">
          <div className="text-xs text-ocean-300 uppercase tracking-wider mb-2">Tu flota</div>
          <ul className="text-sm space-y-1">
            {FLEET.map((spec) => {
              const ship = ships.find((s) => s.id === spec.kind);
              return (
                <li key={spec.kind} className="flex justify-between">
                  <span className="capitalize">{spec.kind} ({spec.length})</span>
                  <span className="text-ocean-300">
                    {ship
                      ? `${String.fromCharCode(65 + ship.origin.x)}${ship.origin.y + 1} ${ship.orientation}`
                      : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-3 bg-ocean-700/40 rounded-lg border border-ocean-500/30 flex flex-col justify-between">
          <div>
            <div className="text-xs text-ocean-300 uppercase tracking-wider mb-1">Rival</div>
            <div className="text-sm">
              {opponentPresent ? opponentNickname ?? 'Rival' : 'Esperando rival…'} ·{' '}
              {opponentReady ? '✅ listo' : '⏳ colocando'}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-900/30 px-3 py-2 rounded my-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleReady}
            disabled={!allValid || submitting || myReady}
            className="mt-2 px-4 py-3 rounded-lg bg-ocean-500 hover:bg-ocean-300 hover:text-ocean-900 font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {myReady
              ? '✅ Listo — esperando rival'
              : submitting
              ? 'Enviando…'
              : !allValid
              ? 'Coloca toda la flota'
              : 'Estoy listo'}
          </button>
        </div>
      </div>
    </div>
  );
}
