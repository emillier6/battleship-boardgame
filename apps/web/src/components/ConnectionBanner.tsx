import { useGameStore } from '../store/gameStore';
import { useNowTick } from '../hooks/useNowTick';

export function ConnectionBanner() {
  const status = useGameStore((s) => s.status);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const opponentDeadline = useGameStore((s) => s.opponentDisconnectDeadline);

  const tickEnabled = opponentDeadline !== null;
  const now = useNowTick(250, tickEnabled);

  const remaining = opponentDeadline === null ? null : Math.max(0, opponentDeadline - now);

  if (status === 'connected' && remaining === null) return null;

  let message = '';
  let className = 'bg-amber-600/80';

  if (remaining !== null) {
    message = `Rival desconectado — ${Math.ceil(remaining / 1000)}s para reconectar`;
    if (remaining <= 0) message = 'Rival desconectado — esperando…';
  } else if (status === 'connecting') {
    message = 'Conectando…';
  } else if (status === 'reconnecting') {
    message = 'Reconectando…';
  } else if (status === 'disconnected') {
    message = 'Desconectado';
  } else if (status === 'error') {
    message = `Error de conexión: ${errorMessage ?? 'desconocido'}`;
    className = 'bg-red-600/80';
  }

  return (
    <div className={`${className} text-white px-4 py-2 text-center text-sm`}>{message}</div>
  );
}
