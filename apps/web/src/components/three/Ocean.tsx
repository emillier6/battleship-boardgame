import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, ShaderMaterial } from 'three';

const vertexShader = `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;

  float hash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  vec2 hash21(float n) {
    return fract(sin(vec2(n * 127.1, n * 311.7)) * 43758.5453123);
  }

  // Localized wave: spawns at a random point, drifts in a random direction,
  // rises, peaks, then sinks back to the surface. The footprint is an
  // elongated, lobed shape rather than a perfect circle.
  float waveBlob(vec2 p, float t, float i) {
    float seed = i * 13.37 + 1.0;
    float period = 7.0 + hash11(seed) * 5.0;
    float offset = hash11(seed + 1.1) * period;
    float phase = mod(t + offset, period);
    float life = phase / period;

    vec2 spawn = (hash21(seed + 2.2) - 0.5) * 80.0;
    float dirAng = hash11(seed + 3.3) * 6.2831853;
    vec2 dir = vec2(cos(dirAng), sin(dirAng));
    vec2 perp = vec2(-dir.y, dir.x);
    float speed = 0.6 + hash11(seed + 4.4) * 1.2;

    vec2 center = spawn + dir * speed * phase;
    vec2 rel = p - center;
    // Project into the blob's local frame (along/perpendicular to travel).
    float u = dot(rel, dir);
    float v = dot(rel, perp);
    float stretch = 1.2 + hash11(seed + 6.6) * 0.5;
    vec2 local = vec2(u / stretch, v);
    float r = length(local);

    // Irregular outline: lobed radial modulation that also drifts slowly.
    float a = atan(local.y, local.x);
    float wobble = 1.0
      + 0.30 * sin(a * 3.0 + seed * 1.7)
      + 0.18 * sin(a * 5.0 - seed * 2.3 + uTime * 0.35)
      + 0.10 * sin(a * 7.0 + seed * 4.1);

    float radius = 0.7 + hash11(seed + 5.5) * 0.8;
    float effR = radius * wobble;

    float env = sin(life * 3.141593);
    env *= env;
    float fall = exp(-(r * r) / (effR * effR));
    return env * fall;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xy;

    float h = 0.0;
    for (int i = 0; i < 60; i++) {
      h += waveBlob(p, uTime, float(i));
    }
    // Very subtle background undulation so the surface is never perfectly flat.
    h += 0.03 * sin(p.x * 0.28 + uTime * 0.5) * cos(p.y * 0.22 + uTime * 0.4);

    pos.z += h * 0.45;
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
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

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
        uniforms={uniforms}
      />
    </mesh>
  );
}
