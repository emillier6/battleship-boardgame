import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, ShaderMaterial } from 'three';

const vertexShader = `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vBoardMask;

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
    float u = dot(rel, dir);
    float v = dot(rel, perp);
    float stretch = 1.2 + hash11(seed + 6.6) * 0.5;
    vec2 local = vec2(u / stretch, v);
    float r = length(local);

    float a = atan(local.y, local.x);
    float wobble = 1.0
      + 0.30 * sin(a * 3.0 + seed * 1.7)
      + 0.18 * sin(a * 5.0 - seed * 2.3 + t * 0.35)
      + 0.10 * sin(a * 7.0 + seed * 4.1);

    float radius = 0.7 + hash11(seed + 5.5) * 0.8;
    float effR = radius * wobble;

    float env = sin(life * 3.141593);
    env *= env;
    float fall = exp(-(r * r) / (effR * effR));
    return env * fall;
  }

  // Box SDF (positive outside, negative inside) — used to keep the area
  // under each board calm so blob waves don't occlude the grid.
  float boardSdf(vec2 p) {
    vec2 halfBoard = vec2(5.5, 5.5);
    vec2 dSelf = abs(p - vec2(-7.0, 0.0)) - halfBoard;
    vec2 dOpp  = abs(p - vec2( 7.0, 0.0)) - halfBoard;
    float sdfSelf = max(dSelf.x, dSelf.y);
    float sdfOpp  = max(dOpp.x,  dOpp.y);
    return min(sdfSelf, sdfOpp);
  }

  // 0 at the center of a board, ~1 once we're a few units away from any board.
  float boardMask(vec2 p) {
    return smoothstep(0.0, 5.0, boardSdf(p));
  }

  // Full height field at point p: short-lived blob waves on top of a
  // constant low-frequency ambient swell so the ocean is never glassy flat.
  // Blob waves are damped over the boards (but not killed) so they don't
  // occlude the grid yet are still visible.
  float surfaceHeight(vec2 p, float t) {
    float blob = 0.0;
    for (int i = 0; i < 90; i++) {
      blob += waveBlob(p, t, float(i));
    }
    blob *= 0.50;

    // Off-board: full amplitude. On-board: 35% amplitude.
    blob *= mix(0.35, 1.0, boardMask(p));

    float amb = 0.060 * sin(p.x * 0.18 + t * 0.35);
    amb += 0.050 * cos(p.y * 0.22 + t * 0.28);
    amb += 0.040 * sin((p.x + p.y) * 0.15 - t * 0.50);
    amb += 0.030 * cos((p.x - p.y) * 0.12 + t * 0.42);
    amb += 0.022 * sin(p.x * 0.45 + p.y * 0.30 + t * 0.70);
    amb += 0.015 * sin(p.x * 0.85 - p.y * 0.55 + t * 1.05);
    return blob + amb;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xy;

    float h = surfaceHeight(p, uTime);
    pos.z += h;
    vHeight = h;
    vBoardMask = boardMask(p);

    // Approximate normals via finite differences in the height field.
    // Lets us light the surface properly and pick up per-wave highlights.
    float eps = 0.35;
    float hx = surfaceHeight(p + vec2(eps, 0.0), uTime);
    float hy = surfaceHeight(p + vec2(0.0, eps), uTime);
    vec3 nLocal = normalize(vec3(-(hx - h) / eps, -(hy - h) / eps, 1.0));
    vWorldNormal = normalize((modelMatrix * vec4(nLocal, 0.0)).xyz);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vBoardMask;

  void main() {
    vec3 deep = vec3(0.012, 0.098, 0.184);
    vec3 mid = vec3(0.043, 0.192, 0.341);
    vec3 lite = vec3(0.110, 0.357, 0.580);

    float t = smoothstep(-0.55, 0.55, vHeight);
    vec3 base = mix(deep, mid, t);
    base = mix(base, lite, smoothstep(0.05, 0.55, vHeight));
    float foam = smoothstep(0.35, 0.70, vHeight);
    base = mix(base, vec3(0.75, 0.88, 0.97), foam * 0.40);

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(vec3(0.55, 0.71, 0.55));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 90.0);

    // Fresnel: grazing angles reflect more of the sky tint.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 sky = vec3(0.22, 0.38, 0.55);

    vec3 color = base * (0.55 + 0.55 * diff);
    color = mix(color, sky, fres * 0.45);
    color += vec3(1.0, 0.96, 0.85) * spec * 0.95;

    // Over the boards, drop the alpha so wave crests reveal the grid below.
    float alpha = mix(0.45, 1.0, vBoardMask);
    gl_FragColor = vec4(color, alpha);
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
      position={[12, -0.2, 5]}
      receiveShadow
    >
      <planeGeometry args={[100, 100, 160, 160]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
