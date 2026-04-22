# Resumen - Fase 4 (HU-008) - Simulador CLI

Fecha: 2026-04-21

## Objetivo

Implementar HU-008: un simulador CLI standalone que genere eventos de partido (`MatchEvent`) y los publique al topic Kafka `match.events`, permitiendo pruebas end-to-end del `odds-engine` y del pipeline de publicación de cuotas.

## Alcance de esta entrega (MVP)

- Workspace `simulator/` añadido al monorepo con scaffold TypeScript.
- CLI con comandos `list` y `run`.
- Formato de escenarios en JSON con validación estricta.
- Mapper desde escenarios al contrato canónico `MatchEvent` de `@betting-engine/shared-kernel`.
- Publicador Kafka (`kafkajs`) que envía mensajes a `match.events` con key por `matchId`.
- Scenarios iniciales: `normal-match` y `high-volatility`.
- Tests unitarios básicos para mapper y validador.
- Modo `--fresh-match-ids` para ejecutar corridas repetidas sin editar escenarios.

## Exclusiones

- No se implementó ingestión HTTP ni API Gateway en esta fase.
- No se incluyó autenticación HMAC o validación de proveedor (queda para ingesta real futura).

## Verificación y uso

Requisitos: infra local levantada (`pnpm docker:up`) y dependencias instaladas en el monorepo (`pnpm install`).

Comandos útiles:

```
pnpm --filter @betting-engine/simulator list-scenarios
pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x
pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids
```

Checks operativos:

- `pnpm --filter @betting-engine/simulator typecheck` — debe pasar.
- `pnpm --filter @betting-engine/simulator build` — debe compilar.
- `pnpm --filter @betting-engine/simulator test` — tests unitarios deben pasar.
- Ejecutar `simulate` con infraestructura levantada: los eventos deben aparecer en el topic `match.events` y `odds-engine` deberá procesarlos hasta publicar cuotas en Redis.

## Archivos añadidos/actualizados

- `simulator/` (nuevo)
- `docs/PHASE4_SUMMARY.md` (este archivo)
- `simulator/README.md` (actualizado con uso)
- `docs/DEVELOPMENT.md` (sección de simulador actualizada)
- `docs/CRONOLOGIA_IMPLEMENTACION (3).md` (nota de estado añadida)

## Siguientes pasos recomendados

1. Integrar el `simulate` en el script E2E para pruebas automáticas.
2. Añadir más escenarios y herramientas para generación aleatoria reproducible.
3. Considerar endpoints HTTP opcionales para controlar escenarios desde API Gateway (Fase 5).

---
Documento generado automáticamente tras el primer sprint de implementación del simulador.
