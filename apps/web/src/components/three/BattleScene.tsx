import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BOARD_SIZE, coordEq, type Board, type Coord, type Ship } from '@battleship/shared';
import { Ocean } from './Ocean';
import { Board as BoardMesh, cellToWorld } from './Board';
import { Ship as ShipMesh } from './Ship';
import { Shot } from './Shot';
import { HitMarker, MissMarker } from './HitMarker';
import { useGameStore } from '../../store/gameStore';

const SELF_ORIGIN: [number, number, number] = [0, 0, 0];
const OPP_ORIGIN: [number, number, number] = [BOARD_SIZE + 4, 0, 0];

const CAM_TARGET: [number, number, number] = [BOARD_SIZE + 2, 0, BOARD_SIZE / 2];

interface ActiveAnimation {
  id: number;
  fromBoard: 'self' | 'opp';
  at: Coord;
}

interface BattleSceneProps {
  myBoard: Board;
  opponentShips?: Ship[];
  myShotsView: { at: Coord; outcome: 'hit' | 'miss' }[];
  opponentShotsOnMe: Coord[];
  isMyTurn: boolean;
  pendingAim: Coord | null;
  onCellClick: (c: Coord) => void;
  freezeInteraction?: boolean;
}

function isHitOnMyBoard(at: Coord, myBoard: Board): boolean {
  for (const ship of myBoard.ships) {
    for (let i = 0; i < ship.length; i++) {
      const c = {
        x: ship.origin.x + (ship.orientation === 'H' ? i : 0),
        y: ship.origin.y + (ship.orientation === 'V' ? i : 0),
      };
      if (coordEq(c, at)) return true;
    }
  }
  return false;
}

export function BattleScene({
  myBoard,
  opponentShips = [],
  myShotsView,
  opponentShotsOnMe,
  isMyTurn,
  pendingAim,
  onCellClick,
  freezeInteraction = false,
}: BattleSceneProps) {
  const lastShotEvent = useGameStore((s) => s.lastShotEvent);
  const playerId = useGameStore((s) => s.playerId);
  const [active, setActive] = useState<ActiveAnimation[]>([]);
  const [recentMarkers, setRecentMarkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!lastShotEvent || !playerId) return;
    const byMe = lastShotEvent.by === playerId;
    setActive((prev) => [
      ...prev,
      { id: lastShotEvent.id, fromBoard: byMe ? 'self' : 'opp', at: lastShotEvent.at },
    ]);
  }, [lastShotEvent, playerId]);

  const inFlightCells = useMemo(() => {
    const selfSet = new Set<string>();
    const oppSet = new Set<string>();
    for (const a of active) {
      const key = `${a.at.x},${a.at.y}`;
      if (a.fromBoard === 'self') oppSet.add(key);
      else selfSet.add(key);
    }
    return { self: selfSet, opp: oppSet };
  }, [active]);

  const completeAnimation = (id: number, key: string) => {
    setActive((prev) => prev.filter((a) => a.id !== id));
    setRecentMarkers((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setTimeout(() => {
      setRecentMarkers((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 700);
  };

  const myCellHighlights = useMemo(() => {
    return opponentShotsOnMe
      .filter((at) => !inFlightCells.self.has(`${at.x},${at.y}`))
      .map((at) => ({
        coord: at,
        color: isHitOnMyBoard(at, myBoard) ? 'transparent' : 'transparent',
      }));
  }, [opponentShotsOnMe, inFlightCells.self, myBoard]);

  const aimHighlight = useMemo(() => {
    if (!pendingAim || !isMyTurn) return [];
    return [{ coord: pendingAim, color: '#ffd23d' }];
  }, [pendingAim, isMyTurn]);

  return (
    <Canvas
      shadows
      camera={{ position: [BOARD_SIZE + 2, 18, BOARD_SIZE + 18], fov: 35 }}
    >
      <color attach="background" args={['#03192f']} />
      <fog attach="fog" args={['#03192f', 25, 70]} />
      <ambientLight intensity={0.5} color="#88a8c8" />
      <directionalLight
        position={[14, 18, 14]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#ffeac0"
      />

      <Ocean />

      <BoardMesh origin={SELF_ORIGIN} highlightCells={myCellHighlights} />
      {myBoard.ships.map((ship) => (
        <ShipMesh key={`self-${ship.id}`} ship={ship} origin={SELF_ORIGIN} />
      ))}

      <BoardMesh
        origin={OPP_ORIGIN}
        highlightCells={aimHighlight}
        onCellClick={freezeInteraction ? undefined : onCellClick}
      />
      {opponentShips.map((ship) => (
        <ShipMesh key={`opp-${ship.id}`} ship={ship} origin={OPP_ORIGIN} />
      ))}

      {opponentShotsOnMe
        .filter((at) => !inFlightCells.self.has(`${at.x},${at.y}`))
        .map((at) => {
          const key = `self-${at.x}-${at.y}`;
          const fresh = recentMarkers.has(`self:${at.x},${at.y}`);
          return isHitOnMyBoard(at, myBoard) ? (
            <HitMarker key={key} coord={at} origin={SELF_ORIGIN} fresh={fresh} />
          ) : (
            <MissMarker key={key} coord={at} origin={SELF_ORIGIN} fresh={fresh} />
          );
        })}

      {myShotsView
        .filter((s) => !inFlightCells.opp.has(`${s.at.x},${s.at.y}`))
        .map(({ at, outcome }) => {
          const key = `opp-${at.x}-${at.y}`;
          const fresh = recentMarkers.has(`opp:${at.x},${at.y}`);
          return outcome === 'hit' ? (
            <HitMarker key={key} coord={at} origin={OPP_ORIGIN} fresh={fresh} />
          ) : (
            <MissMarker key={key} coord={at} origin={OPP_ORIGIN} fresh={fresh} />
          );
        })}

      {active.map((a) => {
        const fromOrigin = a.fromBoard === 'self' ? SELF_ORIGIN : OPP_ORIGIN;
        const toOrigin = a.fromBoard === 'self' ? OPP_ORIGIN : SELF_ORIGIN;
        const from = cellToWorld(
          { x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 },
          fromOrigin,
        ).toArray() as [number, number, number];
        from[1] = 1;
        const to = cellToWorld(a.at, toOrigin).toArray() as [number, number, number];
        const markerKey =
          a.fromBoard === 'self' ? `opp:${a.at.x},${a.at.y}` : `self:${a.at.x},${a.at.y}`;
        return (
          <Shot
            key={a.id}
            from={from}
            to={to}
            onComplete={() => completeAnimation(a.id, markerKey)}
          />
        );
      })}

      <OrbitControls
        target={CAM_TARGET}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.4}
        minPolarAngle={Math.PI / 6}
        minDistance={10}
        maxDistance={40}
      />
    </Canvas>
  );
}
