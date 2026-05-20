import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { clearCreds } from '../lib/persistence';
import { sounds } from '../lib/sounds';

export function GameOverModal() {
  const winner = useGameStore((s) => s.winner);
  const playerId = useGameStore((s) => s.playerId);
  const roomCode = useGameStore((s) => s.roomCode);
  const finalBoards = useGameStore((s) => s.finalBoards);
  const isWinner = winner === playerId;

  useEffect(() => {
    const id = setTimeout(() => {
      if (isWinner) sounds.victory();
      else sounds.defeat();
    }, 400);
    return () => clearTimeout(id);
  }, [isWinner]);

  const handleNewGame = () => {
    if (roomCode) clearCreds(roomCode);
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="max-w-lg w-full bg-ocean-700 border border-ocean-500/40 rounded-xl p-6 space-y-4 shadow-2xl">
        <div className="text-center space-y-1">
          <div className="text-5xl">{isWinner ? '🎉' : '💥'}</div>
          <h2 className="text-3xl font-bold">
            {isWinner ? '¡Victoria!' : 'Derrota'}
          </h2>
          <p className="text-ocean-300 text-sm">
            {isWinner ? 'Has hundido toda la flota rival' : 'Tu flota ha sido hundida'}
          </p>
        </div>

        {finalBoards && (
          <details className="text-xs bg-ocean-900/40 rounded-lg p-3">
            <summary className="cursor-pointer text-ocean-300">Ver tableros finales</summary>
            <pre className="overflow-auto max-h-60 mt-2">
              {JSON.stringify(finalBoards, null, 2)}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNewGame}
            className="flex-1 py-3 rounded-lg bg-ocean-500 hover:bg-ocean-300 hover:text-ocean-900 font-semibold transition"
          >
            Nueva partida
          </button>
        </div>
      </div>
    </div>
  );
}
