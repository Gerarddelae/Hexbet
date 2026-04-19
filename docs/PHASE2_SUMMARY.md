# Resumen - Fase 2 (HU-002 Odds Engine)

Fecha: 2026-04-18

Este documento resume lo implementado en la Fase 2 del proyecto HexBet.

## Objetivo

Implementar HU-002 en odds-engine: consumir eventos de partido desde Kafka (`match.events`), procesarlos de forma idempotente y persistir el estado del partido en PostgreSQL.

## Implementado

- Integracion de microservicio Kafka en odds-engine (arranque hibrido HTTP + Kafka).
- Consumer Kafka para topic `match.events` con manejo de payload y validacion de shape minima.
- Caso de uso `ProcessMatchEventUseCase` para procesar:
  - `MATCH_START`
  - `GOAL`
  - `YELLOW_CARD`
  - `RED_CARD`
  - `MATCH_END`
- Persistencia transaccional en PostgreSQL con adaptador repositorio.
- Idempotencia por `(provider, provider_event_id)` usando `odds_engine.match_event_log`.
- Logging operacional basico en consumo Kafka (topic, partition, offset, tipo de evento, resultado processed/duplicate).
- Pruebas unitarias del caso de uso (4 escenarios clave).
- Documentacion operativa actualizada para validar HU-002.

## Archivos Clave

- apps/odds-engine/src/main.ts
- apps/odds-engine/src/app.module.ts
- apps/odds-engine/src/application/use-cases/process-match-event.use-case.ts
- apps/odds-engine/src/application/use-cases/process-match-event.use-case.spec.ts
- apps/odds-engine/src/domain/models/match-state.model.ts
- apps/odds-engine/src/domain/ports/match-repository.port.ts
- apps/odds-engine/src/infrastructure/adapters/outbound/postgres/postgres-match.repository.ts
- apps/odds-engine/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts
- apps/odds-engine/src/database/data-source.ts
- apps/odds-engine/package.json
- apps/odds-engine/tsconfig.json
- docs/DEVELOPMENT.md
- apps/odds-engine/README.md

## Scripts Actualizados

En apps/odds-engine/package.json:

- `test`: ejecuta pruebas unitarias con `tsx --test src/**/*.spec.ts`
- `migration:run`: `pnpm build && pnpm exec typeorm migration:run -d dist/apps/odds-engine/src/database/data-source.js`
- `migration:revert`: `pnpm build && pnpm exec typeorm migration:revert -d dist/apps/odds-engine/src/database/data-source.js`

## Validacion Ejecutada

- pnpm --filter @betting-engine/odds-engine typecheck: OK
- pnpm --filter @betting-engine/odds-engine test: OK (4/4)
- pnpm --filter @betting-engine/odds-engine build: OK
- pnpm typecheck (monorepo): OK
- pnpm --filter @betting-engine/odds-engine migration:run: OK
- Verificacion E2E manual HU-002: OK
  - Evento nuevo en `match.events` crea/actualiza `odds_engine.matches`
  - Evento duplicado con mismo `provider + providerEventId` no vuelve a mutar estado
  - Conteo en `odds_engine.match_event_log` para la clave duplicada se mantiene en 1

## Notas Operativas

- En Windows con pnpm, la ejecucion de migraciones es mas estable usando `pnpm exec typeorm` sobre el data source compilado en `dist`.
- El `DataSource` de TypeORM debe exportar una sola instancia para evitar error de carga de migrations.
- Para levantar el stack local, asegurarse de no tener otro contenedor ocupando el puerto 5432.

## Fuera de Alcance de Esta Entrega

- HU-003 (calculo de cuotas y publicacion a Redis/Kafka `odds.updated`).
- HU-004+ (catalogo de partidos en bet-service, apuestas, settlement).
- Observabilidad avanzada transversal.

## Siguientes Pasos Recomendados (Fase 3)

1. Implementar `RecalculateOddsUseCase` en odds-engine.
2. Agregar `OddsCalculatorService` con modelo simplificado documentado.
3. Publicar cuotas en Redis (`odds:{matchId}` con TTL) y Kafka (`odds.updated`).
4. Añadir pruebas unitarias para el calculo de cuotas y pruebas de integracion de publicacion.
5. Validar flujo completo: `match.events` -> recalculo -> Redis/Kafka.
