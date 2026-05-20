import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, ShaderMaterial } from 'three';

const vertexShader = `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;

  vec3 gerstner(vec2 pos, vec2 dir, float wavelength, float steepness, float speed, float t) {
    float k = 6.28318 / wavelength;
    float c = speed;
    vec2 d = normalize(dir);
    float f = k * (dot(d, pos) - c * t);
    float a = steepness / k;
    return vec3(d.x * (a * cos(f)), a * sin(f), d.y * (a * cos(f)));
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xy;
    vec3 g1 = gerstner(p, vec2(1.0, 0.3), 8.0, 0.18, 1.2, uTime);
    vec3 g2 = gerstner(p, vec2(-0.5, 1.0), 5.0, 0.13, 0.8, uTime);
    vec3 g3 = gerstner(p, vec2(0.6, -0.8), 3.0, 0.08, 1.6, uTime);
    pos.x += g1.x + g2.x + g3.x;
    pos.y += g1.z + g2.z + g3.z;
    pos.z += g1.y + g2.y + g3.y;
    vHeight = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;
  void main() {
    vec3 deep = vec3(0.012, 0.098, 0.184);
    vec3 mid = vec3(0.043, 0.192, 0.341);
    vec3 light = vec3(0.110, 0.357, 0.580);
    float t = smoothstep(-0.35, 0.35, vHeight);
    vec3 color = mix(deep, mid, t);
    color = mix(color, light, smoothstep(0.15, 0.4, vHeight));
    float foam = smoothstep(0.32, 0.5, vHeight);
    color = mix(color, vec3(0.7, 0.85, 0.95), foam * 0.6);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function Ocean() {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);

  useFrame((_, delta) => {
    const u = matRef.current?.uniforms.uTime;
    if (u) u.value += delta;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[5, -0.2, 5]}
      receiveShadow
    >
      <planeGeometry args={[80, 80, 120, 120]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}
