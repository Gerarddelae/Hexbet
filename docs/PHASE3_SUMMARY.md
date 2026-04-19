# Resumen - Fase 3 (HU-003 Odds Engine)

Fecha: 2026-04-19

Este documento resume lo implementado en la Fase 3 del proyecto HexBet.

## Objetivo

Implementar HU-003 en odds-engine: recalcular cuotas en tiempo real a partir de eventos de partido ya procesados y publicar las cuotas en Redis y Kafka para consumo de servicios siguientes.

## Implementado

- Integracion de HU-003 sobre flujo HU-002 existente.
- `ProcessMatchEventUseCase` actualizado para retornar:
  - `status: processed` + `matchState`
  - `status: duplicate` + `matchState: null`
- `MatchEventsConsumer` actualizado para:
  - recalcular/publicar solo cuando el evento fue `processed`
  - no recalcular en eventos duplicados
- Nuevo `RecalculateOddsUseCase`:
  - calcula cuotas desde estado del partido
  - publica en paralelo a Redis y Kafka
  - aplica reintentos por destino (3 intentos, backoff lineal)
  - reporta resultado agregado: `published`, `partial_failure`, `failed`
- Nuevo `OddsCalculatorService` con modelo simplificado documentado:
  - probabilidades base: local 45%, empate 25%, visitante 30%
  - ajuste por diferencia de goles y minuto
  - ajuste adicional en eventos de tarjeta roja
  - margen (vig) del 5%
  - normalizacion y clamps para evitar odds invalidas
- Nuevo puerto de dominio `OddsPublisherPort` para publicacion dual.
- Nuevo adaptador `RedisKafkaOddsPublisher`:
  - Redis key `odds:{matchId}` con TTL configurable
  - Kafka topic `odds.updated` con `matchId` como key
- Dependencia agregada en odds-engine: `ioredis`.

## Archivos Clave

- apps/odds-engine/src/application/use-cases/process-match-event.use-case.ts
- apps/odds-engine/src/application/use-cases/recalculate-odds.use-case.ts
- apps/odds-engine/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts
- apps/odds-engine/src/domain/services/odds-calculator.service.ts
- apps/odds-engine/src/domain/ports/odds-publisher.port.ts
- apps/odds-engine/src/infrastructure/adapters/outbound/messaging/redis-kafka-odds.publisher.ts
- apps/odds-engine/src/app.module.ts
- apps/odds-engine/package.json
- pnpm-lock.yaml
- docs/DEVELOPMENT.md

## Pruebas Agregadas/Actualizadas

- Nuevo test de dominio: `odds-calculator.service.test.ts`
- Nuevo test de aplicacion: `recalculate-odds.use-case.test.ts`
- Ajuste de tests de HU-002 por nuevo contrato de retorno:
  - `process-match-event.use-case.test.ts`

## Validacion Ejecutada

- `pnpm --filter @betting-engine/odds-engine typecheck`: OK
- `pnpm --filter @betting-engine/odds-engine test`: OK (24/24)
- `pnpm --filter @betting-engine/odds-engine build`: OK

## Variables de Entorno Relevantes (HU-003)

- `KAFKA_ODDS_UPDATED_TOPIC` (default: `odds.updated`)
- `REDIS_ODDS_TTL_SECONDS` (default: `300`)
- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6379`)
- `KAFKA_BROKERS` (default: `localhost:9092`)

## Fuera de Alcance de Esta Entrega

- HU-004+ (implementacion funcional completa de bet-service).
- HU-005+ (implementacion funcional completa de settlement).
- E2E automatizado full-stack de punta a punta entre todos los servicios.
- Observabilidad avanzada transversal (metrics/tracing).

## Siguientes Pasos Recomendados

1. Agregar prueba de integracion HU-003 con infraestructura (Redis + Kafka reales).
2. Documentar y automatizar escenario de fallo parcial (Redis o Kafka no disponibles).
3. Exponer configuracion de reintentos/backoff por variables de entorno.
4. Preparar contrato operativo para consumo de `odds.updated` desde bet-service.
