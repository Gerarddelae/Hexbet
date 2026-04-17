# Resumen - Fase 1 (Infraestructura Base)

Fecha: 2026-04-17

Este documento resume lo implementado en la Fase 1 del proyecto HexBet.

## Objetivo

Establecer un entorno local reproducible para los microservicios con Kafka, PostgreSQL y Redis; crear scaffolds iniciales de apps NestJS; y habilitar validaciones base en CI.

## Implementado

- Infraestructura local con Docker Compose:
  - Zookeeper
  - Kafka (single-broker)
  - Kafka setup para creacion de topics
  - PostgreSQL
  - Redis
- Inicializacion automatica de topics Kafka:
  - match.events
  - odds.updated
  - bet.placed
  - bet.settled
  - bet.placed.dlq
- Inicializacion de schemas PostgreSQL:
  - odds_engine
  - bet_service
  - settlement
- Scaffolds minimos NestJS para:
  - apps/api-gateway
  - apps/odds-engine
  - apps/bet-service
  - apps/settlement
- Endpoints de salud en cada app: GET /health
- Base de migraciones TypeORM para:
  - odds-engine
  - bet-service
  - settlement
- Pipeline CI base en GitHub Actions:
  - lint
  - typecheck
  - build
  - test

## Archivos Clave

- docker-compose.yml
- docker-compose.test.yml
- infra/kafka/create-topics.sh
- infra/postgres/init/01-init-schemas.sql
- .github/workflows/ci.yml
- apps/*/src/main.ts
- apps/*/src/app.module.ts
- apps/*/src/health.controller.ts
- apps/*/src/database/data-source.ts
- apps/*/src/database/migrations/*.ts

## Scripts Agregados

En package.json raiz:

- pnpm docker:up
- pnpm docker:down
- pnpm docker:reset
- pnpm docker:cleanup:legacy
- pnpm docker:ps
- pnpm docker:topics
- pnpm docker:test:up
- pnpm docker:test:down
- pnpm ci:check

## Validacion Ejecutada

- pnpm install: OK
- pnpm typecheck: OK
- pnpm build: OK
- pnpm test: OK (tests placeholder)
- pnpm docker:up: OK
- pnpm docker:topics: OK

## Notas Operativas

- El primer arranque puede tardar por pull de imagenes y warm-up de healthchecks.
- pnpm docker:up usa --wait para reducir carreras de arranque.
- Existe script de limpieza para contenedores legacy con nombres fijos: pnpm docker:cleanup:legacy.

## Fuera de Alcance de Esta Entrega

- Logica de negocio de odds/bets/settlement.
- Integracion de consumidores y productores Kafka en apps.
- Observabilidad avanzada (Prometheus/Grafana/Tracing).
- Suite real de tests unitarios e integracion.

## Siguientes Pasos Recomendados (Fase 1.1)

1. Integrar modulo de configuracion por app y validacion estricta de variables de entorno.
2. Conectar realmente Kafka client/consumer en odds-engine, bet-service y settlement.
3. Ejecutar migraciones automaticamente al arranque controlado de cada servicio.
4. Sustituir tests placeholder por smoke tests reales.
5. Añadir lint/format real (ESLint + Prettier) en monorepo.
