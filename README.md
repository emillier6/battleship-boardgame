# Battleship Web

Juego web multijugador online basado en Hundir la Flota. Stack: **Astro + React + Three.js (r3f)** en front, **Node + Socket.IO** en back. Monorepo pnpm.

## Estructura

```
apps/web        # Astro + React + r3f
apps/server     # Node + Express + Socket.IO
packages/shared # Tipos y lógica pura del juego (reutilizada cliente/servidor)
```

## Arranque

```bash
# Requiere: Node 20+ y pnpm 9+ (corepack enable pnpm)
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/server/.env.example apps/server/.env
pnpm dev   # arranca web (:4321) y server (:3001) en paralelo
```

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Web + server en paralelo |
| `pnpm build` | Build de todos los paquetes |
| `pnpm test` | Tests unitarios + integración |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm typecheck` | Verificación de tipos |

## Roadmap

Fases:
- [x] Fase 0 — Scaffolding
- [x] Fase 1 — Lógica pura compartida (38 tests, 97.7% cobertura)
- [x] Fase 2 — Servidor Socket.IO (15 tests unit + integración)
- [x] Fase 3 — Frontend lobby con Astro SSR
- [x] Fase 4 — Escena 3D + colocación drag-and-drop (r3f)
- [x] Fase 5 — Combate con confirmación de disparo + animaciones
- [x] Fase 6 — Reconexión automática + forfeit por abandono (2 tests integración)
- [x] Fase 7 — Pulido: Gerstner waves, sonidos sintetizados, animación de hundimiento, controles teclado, mute toggle
