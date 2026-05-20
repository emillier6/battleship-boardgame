import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Ship as ShipType } from '@battleship/shared';

const SHIP_COLORS: Record<ShipType['kind'], string> = {
  carrier: '#bfa14a',
  battleship: '#7a8ba8',
  cruiser: '#5f8a7d',
  submarine: '#3e4a6e',
  destroyer: '#a85f4a',
};

export interface ShipProps {
  ship: ShipType;
  origin?: [number, number, number];
  preview?: 'valid' | 'invalid' | null;
  onPointerDown?: (e: { stopPropagation: () => void }) => void;
}

export function Ship({ ship, origin = [0, 0, 0], preview = null, onPointerDown }: ShipProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sinkProgressRef = useRef(0);
  const wasSunkRef = useRef(ship.sunk);

  const baseColor = SHIP_COLORS[ship.kind] ?? '#888';
  const color =
    preview === 'invalid' ? '#d24a4a' : preview === 'valid' ? '#4adc7a' : baseColor;
  const opacity = preview ? 0.75 : 1.0;

  const isH = ship.orientation === 'H';
  const width = isH ? ship.length : 1;
  const depth = isH ? 1 : ship.length;
  const x = origin[0] + ship.origin.x + width / 2;
  const z = origin[2] + ship.origin.y + depth / 2;
  const y = origin[1] + 0.25;

  useEffect(() => {
    if (ship.sunk && !wasSunkRef.current) {
      sinkProgressRef.current = 0;
    }
    wasSunkRef.current = ship.sunk;
  }, [ship.sunk]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (ship.sunk) {
      sinkProgressRef.current = Math.min(1, sinkProgressRef.current + delta * 0.5);
    }
    const t = sinkProgressRef.current;
    const tiltAxis = isH ? 'z' : 'x';
    groupRef.current.rotation[tiltAxis] = -0.6 * t;
    groupRef.current.position.y = y - 0.6 * t;
  });

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      onPointerDown={(e) => onPointerDown?.(e)}
    >
      <mesh castShadow>
        <boxGeometry args={[width * 0.85, 0.4, depth * 0.85]} />
        <meshStandardMaterial
          color={color}
          transparent={Boolean(preview) || ship.sunk}
          opacity={ship.sunk ? 0.85 : opacity}
        />
      </mesh>

      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[width * 0.5, 0.15, depth * 0.5]} />
        <meshStandardMaterial
          color="#2d3b52"
          transparent={Boolean(preview) || ship.sunk}
          opacity={ship.sunk ? 0.85 : opacity}
        />
      </mesh>
    </group>
  );
}
