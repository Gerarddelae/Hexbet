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

Automatizacion E2E HU-003 (un comando):
- `pnpm e2e:hu003`

Opciones del script (`scripts/e2e-hu003.ps1`):
- `-SkipSetup` omite `docker:up` y migraciones.
- `-SkipServiceStart` asume odds-engine ya levantado.
- `-SkipResilience` ejecuta solo happy path + idempotencia.
- `-KeepServiceRunning` no detiene odds-engine al finalizar.

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
