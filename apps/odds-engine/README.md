# odds-engine

Implementacion de HU-002 (Fase 2): consumo de `match.events` desde Kafka,
procesamiento idempotente y persistencia del estado del partido en PostgreSQL.

## Endpoints

- GET /health

## Kafka

- Consumer group: `odds-engine-consumer` (configurable con `KAFKA_CONSUMER_GROUP_ID`)
- Topic consumido: `match.events`
- Tipos soportados: `MATCH_START`, `GOAL`, `YELLOW_CARD`, `RED_CARD`, `MATCH_END`

## Idempotencia

- Se usa la tabla `odds_engine.match_event_log`
- Clave unica: `(provider, provider_event_id)`
- Si llega un evento duplicado no se vuelve a aplicar al partido

## Variables de Entorno

- `ODDS_ENGINE_PORT` (default: `3001`)
- `KAFKA_BROKERS` o `KAFKA_BROKER` (default: `localhost:9092`)
- `KAFKA_CLIENT_ID` (default: `odds-engine`)
- `KAFKA_CONSUMER_GROUP_ID` (default: `odds-engine-consumer`)
- `POSTGRES_HOST` (default: `localhost`)
- `POSTGRES_PORT` (default: `5432`)
- `POSTGRES_USER_SERVICE` o `POSTGRES_USER`
- `POSTGRES_PASSWORD_SERVICE` o `POSTGRES_PASSWORD`
- `POSTGRES_DB_SERVICE` o `POSTGRES_DB`

## Scripts

- pnpm build
- pnpm typecheck
- pnpm test
- pnpm dev
- pnpm start
- pnpm migration:run
- pnpm migration:revert

## Verificacion Rapida HU-002

1. Levantar infraestructura en la raiz del repo:
	- `pnpm docker:up`
2. Ejecutar migracion del servicio:
	- `pnpm --filter @betting-engine/odds-engine migration:run`
3. Levantar odds-engine:
	- `pnpm --filter @betting-engine/odds-engine dev`
4. Publicar un evento de prueba en `match.events`
5. Verificar en PostgreSQL que se actualiza `odds_engine.matches`
6. Reenviar el mismo `providerEventId` y confirmar que no se duplica el efecto
