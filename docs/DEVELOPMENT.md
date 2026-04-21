# Desarrollo Local - HexBet

## Requisitos

- Node.js 18+
- pnpm 10+
- Docker Desktop

## Primera Ejecucion

1. Instalar dependencias:

   pnpm install

2. Limpiar contenedores legacy (si vienes de una version anterior):

   pnpm docker:cleanup:legacy

3. Levantar infraestructura:

   pnpm docker:up

4. Verificar estado:

   pnpm docker:ps

5. Verificar topics:

   pnpm docker:topics

## Comandos Utiles

- Levantar infraestructura: pnpm docker:up
- Apagar infraestructura: pnpm docker:down
- Reset completo (incluye volumenes): pnpm docker:reset
- Logs: pnpm docker:logs
- Estado de contenedores: pnpm docker:ps
- Topics Kafka: pnpm docker:topics

## Calidad

- Typecheck global: pnpm typecheck
- Build global: pnpm build
- Test global: pnpm test
- Validacion CI local: pnpm ci:check

## Apps (Bootstrap)

- api-gateway: puerto 3000
- odds-engine: puerto 3001
- bet-service: puerto 3002
- settlement: puerto 3003

Todos exponen:

- GET /health

## HU-002 (Odds Engine) - Flujo de Validacion

1. Ejecutar migraciones de odds-engine:
   - pnpm --filter @betting-engine/odds-engine migration:run

2. Levantar el servicio odds-engine:
   - pnpm --filter @betting-engine/odds-engine dev

3. Verificar quality checks del servicio:
   - pnpm --filter @betting-engine/odds-engine typecheck
   - pnpm --filter @betting-engine/odds-engine test
   - pnpm --filter @betting-engine/odds-engine build

4. Publicar eventos a `match.events` y revisar persistencia en PostgreSQL:
   - evento nuevo: debe actualizar `odds_engine.matches`
   - evento duplicado (mismo `provider` + `providerEventId`): debe ignorarse

Notas:
- El consumer Kafka usa por defecto el group id `odds-engine-consumer`.
- Si no se define `KAFKA_BROKERS`, usa `localhost:9092`.

## HU-003 (Odds Engine) - Calculo y Publicacion de Cuotas

Esta fase extiende HU-002: cuando el evento de `match.events` se procesa como nuevo (`processed`),
el servicio recalcula cuotas y las publica en Redis y Kafka.

Componentes implementados:
- `OddsCalculatorService` (modelo simplificado: base 45/25/30, ajuste por marcador/minuto, vig 5%).
- `RecalculateOddsUseCase` (orquesta calculo + publicacion dual).
- `RedisKafkaOddsPublisher` (Redis key `odds:{matchId}` + evento Kafka `odds.updated`).
- Reintentos de publicacion por destino (3 intentos, backoff lineal).

1. Validar calidad del servicio:
   - pnpm --filter @betting-engine/odds-engine typecheck
   - pnpm --filter @betting-engine/odds-engine test
   - pnpm --filter @betting-engine/odds-engine build

2. Levantar infraestructura y servicio:
   - pnpm docker:up
   - pnpm --filter @betting-engine/odds-engine migration:run
   - pnpm --filter @betting-engine/odds-engine dev

3. Publicar un evento en `match.events` (ejemplo manual) y verificar salida:
   - Redis: `odds:{matchId}` debe existir con `home`, `draw`, `away`, `timestamp`.
   - Kafka: debe emitirse un mensaje en `odds.updated` con `matchId`, `odds`, `triggeredByEventId`.

4. Verificar logs operativos:
   - Evento duplicado: no recalcula ni publica cuotas.
   - Evento nuevo: log incluye estado de recalculo y estado de publicacion (`redis`, `kafka`).

Automatizacion E2E HU-003 (flujo actual):
- Terminal A (consumer activo): `pnpm --filter @betting-engine/odds-engine dev`
- Terminal B (publish + verificacion): `pnpm e2e:consumer`

El script `scripts/e2e-publish-verify.js` publica un evento valido en `match.events`
y verifica persistencia en PostgreSQL + Redis para confirmar el flujo por
`MatchEventsConsumer`.

## Fase Futura Recomendada (Portfolio): Ingesta de Proveedor Real

Objetivo: recibir eventos de un proveedor externo (webhook) y mantener el mismo
pipeline interno basado en Kafka.

Flujo propuesto:
- Provider externo -> API Gateway (endpoint de ingesta privado)
- Validacion de autenticidad (API key o firma HMAC)
- Normalizacion al contrato `MatchEvent` de `shared-kernel`
- Publicacion a `match.events`
- Consumo existente en `odds-engine` y `settlement`

Alcance MVP sugerido para portfolio:
- Endpoint `POST /ingest/providers/:provider/match-events`
- Validacion de payload y mapping a `MatchEvent`
- Respuesta `202 Accepted` cuando el evento se publica a Kafka
- Manejo basico de errores (`400`, `401/403`, `500`)

Nota: hasta implementar esta fase, para pruebas se mantiene la publicacion directa
en Kafka via simulador o scripts de E2E.

## Variables de Entorno

Usar .env.example como base y copiar a .env si necesitas personalizar puertos/credenciales.

Variables usadas por HU-003 en odds-engine:
- `KAFKA_ODDS_UPDATED_TOPIC` (default: `odds.updated`)
- `REDIS_ODDS_TTL_SECONDS` (default: `300`)
- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6379`)

## Problemas Frecuentes

1. Kafka no aparece corriendo inmediatamente:
   - Espera unos segundos y corre pnpm docker:ps de nuevo.
   - Si sigue fallando, ejecuta pnpm docker:reset y luego pnpm docker:up.

2. Conflicto con contenedores antiguos:
   - Ejecuta pnpm docker:cleanup:legacy.

3. Topics no listan:
   - Verifica que kafka este healthy en pnpm docker:ps.
   - Reintenta pnpm docker:topics.
