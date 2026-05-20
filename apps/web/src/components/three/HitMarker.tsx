import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Coord } from '@battleship/shared';

interface MarkerProps {
  coord: Coord;
  origin?: [number, number, number];
  fresh?: boolean;
}

export function HitMarker({ coord, origin = [0, 0, 0], fresh = false }: MarkerProps) {
  const ref = useRef<THREE.Group>(null);
  const [age, setAge] = useState(0);

  useFrame((_, delta) => {
    if (fresh) setAge((a) => Math.min(a + delta, 1));
  });

  const intensity = fresh ? 1.0 + Math.sin(age * 12) * 0.3 : 0.6;

  return (
    <group ref={ref} position={[origin[0] + coord.x + 0.5, origin[1] + 0.05, origin[2] + coord.y + 0.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshStandardMaterial
          color="#ff3d2f"
          emissive="#ff6a3d"
          emissiveIntensity={intensity}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.18, 0.4, 12]} />
        <meshStandardMaterial color="#3a1a14" />
      </mesh>
    </group>
  );
}

export function MissMarker({ coord, origin = [0, 0, 0], fresh = false }: MarkerProps) {
  const [age, setAge] = useState(0);
  useFrame((_, delta) => {
    if (fresh) setAge((a) => Math.min(a + delta, 0.6));
  });

  const scale = fresh ? 1 + Math.sin(age * 12) * 0.1 : 1;

  return (
    <group position={[origin[0] + coord.x + 0.5, origin[1] + 0.04, origin[2] + coord.y + 0.5]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.42, 24]} />
        <meshStandardMaterial color="#bcd5ea" transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 24]} />
        <meshStandardMaterial color="#5fa8d3" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
