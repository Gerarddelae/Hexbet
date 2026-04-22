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

- **api-gateway**: puerto 3000 (**punto único de entrada**)
- odds-engine: puerto 3001
- bet-service: puerto 3002
- settlement: puerto 3003

Todos exponen:
- GET /health

> Importante: Los clientes **NUNCA** se comunican directamente con los microservicios. Toda comunicación pasa por `api-gateway` (Fase 5 implementada).

## HU-002 (Odds Engine) - Flujo de Validacion

1. Ejecutar migraciones de odds-engine:
   - pnpm --filter @betting-engine/odds-engine migration:run

2. Levantar el servicio odds-engine:
   - pnpm --filter @betting-engine/odds-engine dev

4. Publicar eventos a `match.events` y revisar persistencia en PostgreSQL:
   - evento nuevo: debe actualizar `odds_engine.matches`
   - evento duplicado (mismo `provider` + `providerEventId`): debe ignorarse

Notas:
- El consumer Kafka usa por defecto el group id `odds-engine-consumer`.
- Si no se define `KAFKA_BROKERS`, usa `localhost:9092`.
- Si el partido ya esta `FINISHED`, nuevos eventos para ese `matchId` no se procesan en `odds-engine`.
- `ProcessMatchEventUseCase` aplica actualizacion monotona (no regresiva): `currentMinute`, `homeScore` y `awayScore` no disminuyen ante reemision de eventos viejos.

## HU-003 (Odds Engine) - Calculo y Publicacion de Cuotas

Esta fase extiende HU-002: cuando el evento de `match.events` se procesa como nuevo (`processed`),
el servicio recalcula cuotas y las publica en Redis y Kafka.

Componentes implementados:
- `OddsCalculatorService` (modelo simplificado: base 45/25/30, ajuste por marcador/minuto, vig 5%).
- `RecalculateOddsUseCase` (orquesta calculo + publicacion dual).
- `RedisKafkaOddsPublisher` (Redis key `odds:{matchId}` + evento Kafka `odds.updated`).
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

Objetivo: recibir eventos de un proveedor externo (webhook) y mantener el mismo flujo interno.
Flujo propuesto:
- Provider externo -> API Gateway (endpoint de ingesta privado)
- Validación de autenticidad (API key o firma HMAC)
- Normalización al contrato `MatchEvent` de `shared-kernel`
- Publicación a `match.events`
- Consumo existente en `odds-engine` y `settlement`

Alcance MVP sugerido para portfolio:
- Endpoint `POST /ingest/providers/:provider/match-events`
- Validación de payload y mapping a `MatchEvent`
- Respuesta `202 Accepted` cuando el evento se publica a Kafka
- Manejo básico de errores (`400`, `401/403`, `500`)

### Evaluación HMAC (2026-04-22)

La recomendación de implementar HMAC para webhooks de Fase 4 fue evaluada:
- **Pertinente**: Sí, para validar autenticidad de proveedores externos.
- **Timing**: No debe confundirse con Fase 5 (JWT para usuarios).
- **Scope separado**: HMAC es para ingestión de proveedores; JWT es para usuarios/clientes.
- **Queda como**: Funcionalidad futura a implementar cuando se añada endpoint de ingestión.

> Nota: hasta implementar esta fase, para pruebas se mantiene la publicación directa en Kafka via simulador o scripts de E2E.

## HU-008 (Simulador) - Modos de Ejecucion

Comandos base:

- Listar escenarios:
   - `pnpm --filter @betting-engine/simulator list-scenarios`
- Ejecutar en modo normal (usa `matchId` del JSON):
   - `pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x`
- Ejecutar en modo fresh (genera `matchId` nuevo por corrida):
   - `pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids`

Notas operativas:

- Modo normal: si el mismo `matchId` ya termino (`FINISHED`), nuevas corridas no agregan eventos persistidos para ese partido.
- Modo fresh: cada corrida crea partidos nuevos sin editar el JSON del escenario.
- El remapeo de `matchId` es solo en memoria; los archivos `scenarios/*.json` no se modifican.
- En escenarios con `matchId` estatico, usar `--fresh-match-ids` evita mezclar corridas en el mismo partido logico.

## HU-005 (API Gateway) - Punto Único de Entrada

### Estado (2026-04-22)

Implementación completa en `apps/api-gateway/` con:

- `ProxyRequestUseCase` - orquesta autenticación JWT, rate limiting y forward
- `JwtAuthAdapter` - validación de tokens JWT
- `HttpServiceRouterAdapter` - forward HTTP a servicios backend
- `RedisRateLimiterAdapter` - rate limiting con Redis
- `GatewayController` - catch-all route `/:service/*`
- `OddsStreamGateway` - WebSocket namespace `stream/odds`

### Validación

1. Verificar calidad:
   - `pnpm --filter @betting-engine/api-gateway typecheck`
   - `pnpm --filter @betting-engine/api-gateway build`

2. Levantar infraestructura:
   - `pnpm docker:up`

3. Levantar API Gateway:
   - `pnpm --filter @betting-engine/api-gateway dev`

4. Verificar health:
   - `curl http://localhost:3000/health`

### Rutas Configureadas

| Path | Servicio | Auth | Rate Limit |
|------|----------|------|------------|
| `/matches/**` | bet-service | No | 100 req/min |
| `/bets` | bet-service | JWT | 10 req/min |
| `/user/**` | bet-service | JWT | 60 req/min |
| `/health` | * | No | 60 req/min |

### Limitaciones Actuales

- El proxy a `bet-service` requiere que el servicio tenga endpoints HTTP implementados (Fase 6 pendiente).
- WebSocket streaming no recibe eventos hasta que odds-engine esté publicando a Kafka y se implemente el consumer en gateway.
- Rate limiting requiere Redis corriendo (`pnpm docker:up`).

### Próximos Pasos

1. Implementar Fase 6 (bet-service `GET /matches/live`, `POST /bets`)
2. Conectar WebSocket con consumo de Kafka para broadcasting de cuotas
3. Implementar endpoint de ingestión con HMAC para proveedores externos

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
