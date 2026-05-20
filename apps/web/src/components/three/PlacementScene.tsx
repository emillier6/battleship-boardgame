import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  BOARD_SIZE,
  FLEET,
  emptyBoard,
  placeShip,
  validateShipPlacement,
  type Coord,
  type Orientation,
  type Ship,
} from '@battleship/shared';
import { Ocean } from './Ocean';
import { Board, worldToCell } from './Board';
import { Ship as ShipMesh } from './Ship';

const BOARD_ORIGIN: [number, number, number] = [0, 0, 0];

interface DragState {
  shipId: string;
  orientation: Orientation;
  pointerCell: Coord | null;
}

function shipCellsForOrigin(
  origin: Coord,
  length: number,
  orientation: Orientation,
): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < length; i++) {
    cells.push({
      x: origin.x + (orientation === 'H' ? i : 0),
      y: origin.y + (orientation === 'V' ? i : 0),
    });
  }
  return cells;
}

function buildInitialShips(): Ship[] {
  return FLEET.map((spec, i) => ({
    id: spec.kind,
    kind: spec.kind,
    length: spec.length,
    origin: { x: 0, y: i * 2 },
    orientation: 'H' as Orientation,
    hits: [],
    sunk: false,
  }));
}

function clampOriginForLength(
  origin: Coord,
  length: number,
  orientation: Orientation,
): Coord {
  const maxX = orientation === 'H' ? BOARD_SIZE - length : BOARD_SIZE - 1;
  const maxY = orientation === 'V' ? BOARD_SIZE - length : BOARD_SIZE - 1;
  return {
    x: Math.max(0, Math.min(origin.x, maxX)),
    y: Math.max(0, Math.min(origin.y, maxY)),
  };
}

function PointerTracker({ onMove }: { onMove: (cell: Coord | null) => void }) {
  const { camera, raycaster, pointer } = useThree();
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitRef = useRef(new THREE.Vector3());
  const lastCellRef = useRef<string | null>(null);

  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.ray.intersectPlane(planeRef.current, hitRef.current);
    let cell: Coord | null = null;
    if (hit) cell = worldToCell(hitRef.current, BOARD_ORIGIN);
    const key = cell ? `${cell.x},${cell.y}` : 'null';
    if (key !== lastCellRef.current) {
      lastCellRef.current = key;
      onMove(cell);
    }
  });

  return null;
}

interface PlacementSceneProps {
  initialShips?: Ship[];
  onShipsChange?: (ships: Ship[]) => void;
  onAllValidChange?: (allValid: boolean) => void;
}

export function PlacementScene({
  initialShips,
  onShipsChange,
  onAllValidChange,
}: PlacementSceneProps) {
  const [ships, setShips] = useState<Ship[]>(() => initialShips ?? buildInitialShips());
  const [drag, setDrag] = useState<DragState | null>(null);

  const allValid = useMemo(() => {
    let scratch = emptyBoard();
    for (const ship of ships) {
      const r = validateShipPlacement(scratch, ship);
      if (!r.ok) return false;
      scratch = placeShip(scratch, ship);
    }
    return true;
  }, [ships]);

  useEffect(() => {
    onShipsChange?.(ships);
  }, [ships, onShipsChange]);

  useEffect(() => {
    onAllValidChange?.(allValid);
  }, [allValid, onAllValidChange]);

  const previewShip = useMemo<Ship | null>(() => {
    if (!drag || !drag.pointerCell) return null;
    const current = ships.find((s) => s.id === drag.shipId);
    if (!current) return null;
    const clamped = clampOriginForLength(drag.pointerCell, current.length, drag.orientation);
    return { ...current, origin: clamped, orientation: drag.orientation };
  }, [drag, ships]);

  const previewValid = useMemo<'valid' | 'invalid' | null>(() => {
    if (!previewShip) return null;
    let scratch = emptyBoard();
    for (const ship of ships) {
      if (ship.id === previewShip.id) continue;
      scratch = placeShip(scratch, ship);
    }
    const r = validateShipPlacement(scratch, previewShip);
    return r.ok ? 'valid' : 'invalid';
  }, [previewShip, ships]);

  useEffect(() => {
    if (!drag) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setDrag((d) => (d ? { ...d, orientation: d.orientation === 'H' ? 'V' : 'H' } : d));
      } else if (e.key === 'Escape') {
        setDrag(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const handleShipPointerDown = useCallback(
    (id: string) => {
      const ship = ships.find((s) => s.id === id);
      if (!ship) return;
      setDrag({ shipId: id, orientation: ship.orientation, pointerCell: ship.origin });
    },
    [ships],
  );

  const handlePointerCellChange = useCallback((cell: Coord | null) => {
    setDrag((d) => (d ? { ...d, pointerCell: cell } : d));
  }, []);

  const handleClick = useCallback(() => {
    if (!drag) return;
    if (previewShip && previewValid === 'valid') {
      setShips((prev) => prev.map((s) => (s.id === previewShip.id ? previewShip : s)));
    }
    setDrag(null);
  }, [drag, previewShip, previewValid]);

  const handleRandomize = useCallback(() => {
    setShips(randomFleet());
  }, []);

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [BOARD_SIZE / 2, 14, BOARD_SIZE + 7], fov: 35 }}
        onClick={handleClick}
      >
        <color attach="background" args={['#03192f']} />
        <fog attach="fog" args={['#03192f', 22, 60]} />
        <ambientLight intensity={0.5} color="#88a8c8" />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          color="#ffeac0"
        />

        <Ocean />

        <Board
          origin={BOARD_ORIGIN}
          highlightCells={
            previewShip
              ? shipCellsForOrigin(
                  previewShip.origin,
                  previewShip.length,
                  previewShip.orientation,
                ).map((coord) => ({
                  coord,
                  color: previewValid === 'valid' ? '#4adc7a' : '#d24a4a',
                }))
              : []
          }
        />

        {ships.map((ship) =>
          drag?.shipId === ship.id ? null : (
            <ShipMesh
              key={ship.id}
              ship={ship}
              origin={BOARD_ORIGIN}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleShipPointerDown(ship.id);
              }}
            />
          ),
        )}

        {previewShip && (
          <ShipMesh ship={previewShip} origin={BOARD_ORIGIN} preview={previewValid} />
        )}

        {drag && <PointerTracker onMove={handlePointerCellChange} />}

        <OrbitControls
          target={[BOARD_SIZE / 2, 0, BOARD_SIZE / 2]}
          enablePan={false}
          enableRotate={!drag}
          maxPolarAngle={Math.PI / 2.4}
          minPolarAngle={Math.PI / 6}
          minDistance={8}
          maxDistance={25}
        />
      </Canvas>

      <div className="absolute top-4 left-4 bg-ocean-700/70 backdrop-blur px-3 py-2 rounded-lg border border-ocean-500/30 text-xs space-y-1 pointer-events-none">
        <div>🖱️ Click en barco → mover · Click en celda → confirmar</div>
        <div>⌨️ R: rotar · Esc: cancelar</div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={handleRandomize}
          className="pointer-events-auto px-3 py-2 rounded-lg bg-ocean-900/80 hover:bg-ocean-700 border border-ocean-500/40 text-sm transition"
        >
          🎲 Aleatorio
        </button>
      </div>
    </>
  );
}

function randomFleet(): Ship[] {
  const board = emptyBoard();
  const ships: Ship[] = [];
  let scratch = board;
  for (const spec of FLEET) {
    let attempts = 0;
    while (attempts < 500) {
      attempts++;
      const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
      const maxX = orientation === 'H' ? BOARD_SIZE - spec.length : BOARD_SIZE - 1;
      const maxY = orientation === 'V' ? BOARD_SIZE - spec.length : BOARD_SIZE - 1;
      const origin: Coord = {
        x: Math.floor(Math.random() * (maxX + 1)),
        y: Math.floor(Math.random() * (maxY + 1)),
      };
      const candidate: Ship = {
        id: spec.kind,
        kind: spec.kind,
        length: spec.length,
        origin,
        orientation,
        hits: [],
        sunk: false,
      };
      const r = validateShipPlacement(scratch, candidate);
      if (r.ok) {
        ships.push(candidate);
        scratch = placeShip(scratch, candidate);
        break;
      }
    }
  }
  if (ships.length < FLEET.length) return buildInitialShips();
  return ships;
}
