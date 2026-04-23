# Resumen - Fase 6 (Bet Service)

Fecha: 2026-04-22

## Objetivo

Implementar el Bet Service como microservicio que gestiona el catálogo de partidos y el registro de apuestas, consumiendo eventos de Kafka y publicando apuestas liquidadas.

## Alcance de Esta Entrega (MVP)

- **Domain Layer**: entidades User, Bet, Match; puertos UserRepositoryPort, BetRepositoryPort, OddsProviderPort, MatchRepositoryPort
- **PostgresUserRepository**: gestión de usuarios y saldo
- **PostgresBetRepository**: persistencia de apuestas
- **PostgresMatchRepository**: lectura de estado de partido desde `odds_engine.matches` (PostgreSQL)
- **RedisOddsProvider**: lectura de cuotas desde Redis keys `odds:{matchId}`
- **GetLiveMatchesUseCase**: combina match state (PostgreSQL) + odds (Redis)
- **PlaceBetUseCase**: validación de usuario, odds, saldo; registro de apuesta
- **MatchesController**: `GET /matches/live`
- **BetsController**: `POST /bets`, `GET /bets/user/:userId`
- **OddsEventsConsumer**: consume `odds.updated` de Kafka → actualiza Redis cache

### Bugfix: Estado de Partido en GetLiveMatches (2026-04-22)

**Problema**: `GetLiveMatchesUseCase` inicialmente usaba `RedisOddsProvider` para todo, incluyendo estado del partido. Eso resultaba en `homeScore: 0`, `awayScore: 0`, `currentMinute: 0` hardcodeados.

**Solución**: Crear `PostgresMatchRepository` que lee directamente de `odds_engine.matches` en PostgreSQL y combina con odds de Redis:
- `findLiveMatches()` → consulta `odds_engine.matches WHERE status = 'LIVE'`
- `getLiveMatchesWithOdds()` → combina con `RedisOddsProvider.getOddsForMatch(matchId)`

**Decisión**: Bet-service consulta `odds_engine.matches` directamente en PostgreSQL en lugar de llamar a odds-engine por HTTP. Esto mantiene el desacoplamiento y evita dependencia de llamada síncrona.

### Bugfix: Integración con API Gateway (2026-04-22)

**Problema**: El proxy a través de API Gateway fallaba con `Cannot read properties of undefined`. Causas múltiples:
- `ProxyRequestUseCase` no se injectaba correctamente en `GatewayController`
- Tokens de string para DI no se resolvían
- `@nestjs/axios` `HttpService` tiene problemas conocidos de inyección con `AXIOS_INSTANCE_TOKEN`

**Solución**:
- Crear constantes exportadas para tokens en `domain/ports/index.ts`
- Usar `@Inject(Token)` en todos los constructores
- Para `HttpServiceRouterAdapter`: usar `axios` directamente creado en el constructor

**Decisión**: Usar `axios` directo en `HttpServiceRouterAdapter` en lugar de `HttpService` de NestJS. Esto funciona inmediatamente y evita los problemas documentados de inyección.

## Verificación y Uso

Requisitos: infraestructura local levantada (PostgreSQL, Redis, Kafka),odds-enginerunning.

```bash
# Levantar Bet Service
pnpm --filter @betting-engine/bet-service dev

# Consultar partidos vivos
curl http://localhost:3002/matches/live

# Colocar apuesta
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","matchId":"<uuid>","selection":"HOME","stakeCents":1000}'
```

Checks operativos:

- `pnpm --filter @betting-engine/bet-service typecheck` — debe pasar
- `pnpm --filter @betting-engine/bet-service build` — debe compilar

## Archivos Añadidos/Actualizados

- `apps/bet-service/src/domain/entities/user.entity.ts` — entidad User
- `apps/bet-service/src/domain/entities/bet.entity.ts` — entidad Bet
- `apps/bet-service/src/domain/entities/match.entity.ts` — entidad Match con Odds embebidos
- `apps/bet-service/src/domain/ports/user-repository.port.ts` — puerto UserRepository
- `apps/bet-service/src/domain/ports/bet-repository.port.ts` — puerto BetRepository
- `apps/bet-service/src/domain/ports/odds-provider.port.ts` — puerto OddsProvider
- `apps/bet-service/src/infrastructure/adapters/outbound/postgres/postgres-user.repository.ts` — PostgreSQL user repo
- `apps/bet-service/src/infrastructure/adapters/outbound/postgres/postgres-bet.repository.ts` — PostgreSQL bet repo
- `apps/bet-service/src/infrastructure/adapters/outbound/postgres/postgres-match.repository.ts` — PostgreSQL match repo (bugfix)
- `apps/bet-service/src/infrastructure/adapters/outbound/redis/redis-odds.provider.ts` — Redis odds provider
- `apps/bet-service/src/infrastructure/adapters/inbound/kafka/odds-events.consumer.ts` — Kafka odds consumer
- `apps/bet-service/src/application/use-cases/get-live-matches.use-case.ts` — caso de uso
- `apps/bet-service/src/application/use-cases/place-bet.use-case.ts` — caso de uso
- `apps/bet-service/src/interface/http/matches.controller.ts` — MatchesController
- `apps/bet-service/src/interface/http/bets.controller.ts` — BetsController
- `apps/bet-service/src/app.module.ts` — módulo principal
- `apps/bet-service/src/main.ts` — bootstrap con migraciones y Kafka
- `apps/bet-service/package.json` — dependencias actualizadas

## Siguientes Pasos Recomendados

1. Integrar Bet Service en API Gateway (proxificar `/matches/live`, `/bets`) ✅ Corregido e integrado
2. Publicar `bet.placed` a Kafka para Settlement
3. Implementar settle-bet desde Settlement → Bet Service

## Verificación End-to-End

Con todos los servicios levantados:

```bash
# Consultar partidos vivos vía Gateway
curl http://localhost:3000/bet-service/matches/live

# Health vía Gateway
curl http://localhost:3000/bet-service/health
```