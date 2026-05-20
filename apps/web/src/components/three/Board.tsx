import { useMemo } from 'react';
import { BOARD_SIZE, type Coord } from '@battleship/shared';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export interface BoardProps {
  origin?: [number, number, number];
  highlightCells?: { coord: Coord; color: string }[];
  showLabels?: boolean;
  onCellHover?: (coord: Coord | null) => void;
  onCellClick?: (coord: Coord) => void;
}

export function boardWorldOrigin(origin: [number, number, number] = [0, 0, 0]) {
  return new THREE.Vector3(...origin);
}

export function cellToWorld(coord: Coord, origin: [number, number, number] = [0, 0, 0]) {
  return new THREE.Vector3(origin[0] + coord.x + 0.5, origin[1], origin[2] + coord.y + 0.5);
}

export function worldToCell(
  point: THREE.Vector3,
  origin: [number, number, number] = [0, 0, 0],
): Coord | null {
  const x = Math.floor(point.x - origin[0]);
  const y = Math.floor(point.z - origin[2]);
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
  return { x, y };
}

export function Board({
  origin = [0, 0, 0],
  highlightCells = [],
  showLabels = true,
  onCellHover,
  onCellClick,
}: BoardProps) {
  const gridLines = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i <= BOARD_SIZE; i++) {
      positions.push(i, 0.01, 0, i, 0.01, BOARD_SIZE);
      positions.push(0, 0.01, i, BOARD_SIZE, 0.01, i);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, []);

  return (
    <group position={origin}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[BOARD_SIZE / 2, 0, BOARD_SIZE / 2]}
        receiveShadow
        onPointerMove={(e) => {
          if (!onCellHover) return;
          e.stopPropagation();
          const cell = worldToCell(e.point, origin);
          onCellHover(cell);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onCellHover?.(null);
        }}
        onClick={(e) => {
          if (!onCellClick) return;
          e.stopPropagation();
          const cell = worldToCell(e.point, origin);
          if (cell) onCellClick(cell);
        }}
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#0b3157" transparent opacity={0.55} />
      </mesh>

      <lineSegments geometry={gridLines}>
        <lineBasicMaterial color="#5fa8d3" transparent opacity={0.45} />
      </lineSegments>

      {highlightCells.map(({ coord, color }, i) => (
        <mesh
          key={`${coord.x}-${coord.y}-${i}`}
          position={[coord.x + 0.5, 0.05, coord.y + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}

      {showLabels && (
        <>
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <Text
              key={`col-${i}`}
              position={[i + 0.5, 0.02, -0.4]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#5fa8d3"
              anchorX="center"
              anchorY="middle"
            >
              {String.fromCharCode(65 + i)}
            </Text>
          ))}
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <Text
              key={`row-${i}`}
              position={[-0.4, 0.02, i + 0.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#5fa8d3"
              anchorX="center"
              anchorY="middle"
            >
              {i + 1}
            </Text>
          ))}
        </>
      )}
    </group>
  );
}
