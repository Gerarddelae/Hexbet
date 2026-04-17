# Resumen — Fase 0 (Bootstrap Monorepo)

Fecha: 2026-04-16

Este archivo resume todo lo que se implementó en la Fase 0 del proyecto "Betting Engine" (monorepo), dejando la base lista para agregar los servicios NestJS en las fases siguientes.

## Objetivo
Dejar un monorepo reproducible y listo para desarrollo con:
- gestores de paquetes y workspaces (`pnpm`),
- orquestación de tareas rápida y cacheada (`turborepo`),
- un paquete compartido `shared-kernel` con los contratos (tipos/eventos/puertos),
- scripts raíz para build/typecheck/test/lint.

## Qué implementé (resumen)
- Inicialización del monorepo con `pnpm` y Workspaces.
- Instalación e configuración de Turborepo (local) para orquestar tareas.
- Configuración TypeScript base y alias de paths para `@betting-engine/shared-kernel`.
- Creación del paquete `packages/shared-kernel` con:
  - Tipos y eventos: `match.events.ts`, `bet.events.ts`, `odds.events.ts`.
  - Puerto `IMatchDataProvider` en `ports/match-data-provider.port.ts`.
  - Exportaciones públicas en `src/index.ts`.
- Scripts raíz y pipeline Turbo (`turbo.json`) con tareas: `build`, `typecheck`, `lint`, `test`, `dev`.
- Creación de placeholders para aplicaciones: `apps/api-gateway`, `apps/odds-engine`, `apps/bet-service`, `apps/settlement` y `simulator`.

## Archivos y rutas importantes (creados/actualizados)
- `pnpm-workspace.yaml` — define workspaces: `apps/*`, `packages/*`, `simulator`.
- `package.json` (raíz) — scripts globales: `typecheck`, `build`, `lint`, `test`, `dev`, `format`.
- `turbo.json` — pipeline/tasks de Turborepo.
- `tsconfig.base.json` — configuración TypeScript con alias:
  - `@betting-engine/shared-kernel` → `packages/shared-kernel/src`
- `packages/shared-kernel/`:
  - `package.json` (scripts `build`/`typecheck`)
  - `tsconfig.json`
  - `src/events/match.events.ts`
  - `src/events/bet.events.ts`
  - `src/events/odds.events.ts`
  - `src/ports/match-data-provider.port.ts`
  - `src/index.ts`
- `apps/` and `simulator/` — carpetas placeholder con `README.md` para cada servicio.

## Comandos útiles (desde la raíz del repo)
Ejecuta en PowerShell (o terminal POSIX equivalente):

```powershell
pnpm install
pnpm typecheck   # ejecuta turbo run typecheck
pnpm build       # ejecuta turbo run build
pnpm lint
pnpm test
pnpm dev        # ejecuta tareas dev en paralelo (si se configuran)
```

Para crear un nuevo servicio NestJS (ejemplo):

```powershell
pnpm dlx @nestjs/cli new apps/api-gateway --package-manager pnpm --skip-install --strict
pnpm install
pnpm build
```

Nota: `pnpm dlx` ejecuta temporalmente el CLI sin instalar globalmente.

## Notas técnicas relevantes
- TypeScript configurado con `ignoreDeprecations` para compatibilidad con TS6 y con `moduleResolution: NodeNext`.
- Turborepo está instalado como dependencia dev en la raíz (no global), y se usa para cache y ejecución de tareas.
- `shared-kernel` está pensado solo para tipos e interfaces (contratos). No contiene lógica de negocio ni adaptadores.
- Se añadió `provider` y `providerEventId` en `MatchEvent` para soportar idempotencia en consumidores futuros.

## Estado actual / Validación
- `pnpm install`: OK
- `pnpm typecheck`: OK
- `pnpm build`: OK
- `pnpm lint`: OK (placeholder)
- `pnpm test`: OK (placeholder)

## Siguientes pasos propuestos
1. Decidir si quieres que genere los scaffolds NestJS ahora (api-gateway, odds-engine, bet-service, settlement). Puedo hacerlo y conectar automáticamente sus `package.json` y scripts al pipeline Turbo.
2. Añadir linter (ESLint) y formato (Prettier) si quieres más consistencia de código desde el inicio.
3. Implementar pruebas unitarias iniciales para `shared-kernel` si deseas asegurar contratos.
4. Preparar `docker-compose` y servicios de infraestructura (Kafka, Postgres, Redis) en Fase 1.

---
Si quieres, continúo ahora con el scaffold automático de las apps NestJS o te dejo los scripts por servicio listos para cuando ejecutes `pnpm dlx @nestjs/cli`.
