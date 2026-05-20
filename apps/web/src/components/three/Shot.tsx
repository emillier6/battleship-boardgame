import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface ShotProps {
  from: [number, number, number];
  to: [number, number, number];
  duration?: number;
  onComplete?: () => void;
}

export function Shot({ from, to, duration = 0.8, onComplete }: ShotProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [elapsed, setElapsed] = useState(0);

  useFrame((_, delta) => {
    setElapsed((prev) => {
      const next = prev + delta;
      if (next >= duration) {
        onComplete?.();
        return duration;
      }
      return next;
    });
  });

  const t = Math.min(elapsed / duration, 1);
  const x = from[0] + (to[0] - from[0]) * t;
  const z = from[2] + (to[2] - from[2]) * t;
  const archHeight = 6;
  const y = from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * archHeight;

  return (
    <mesh ref={meshRef} position={[x, y, z]} castShadow>
      <sphereGeometry args={[0.2, 12, 12]} />
      <meshStandardMaterial color="#222" emissive="#ff6a3d" emissiveIntensity={0.8} />
    </mesh>
  );
}
