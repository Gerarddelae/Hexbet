# simulator

Simulador CLI standalone para generar eventos de partido y publicarlos en Kafka (`match.events`).

## Objetivo

- Generar eventos canonicos `MatchEvent` para pruebas locales.
- Ejecutar escenarios predefinidos con factor de velocidad.
- Validar el pipeline de `odds-engine` sin depender de un proveedor real.

## Requisitos

- Infraestructura levantada (`pnpm docker:up` en la raiz del repo).
- Dependencias instaladas (`pnpm install` en la raiz).

## Comandos

- Listar escenarios disponibles:

	`pnpm --filter @betting-engine/simulator list-scenarios`

- Ejecutar un escenario por nombre:

	`pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x`

- Ejecutar con `matchId` nuevo en cada corrida (sin editar JSON):

	`pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids`

- Ejecutar un escenario por ruta:

	`pnpm --filter @betting-engine/simulator simulate -- --scenario scenarios/high-volatility.json --speed 30`

## Opciones de CLI

- `--scenario`, `-s`: nombre del escenario o ruta a archivo `.json`.
- `--speed`, `-x`: factor de velocidad (`1`, `30`, `60`, `60x`).
- `--fresh-match-ids`: regenera un `matchId` UUID para cada escenario en memoria por corrida.

## Modos de ejecucion

### Modo normal (por defecto)

Usa el `matchId` definido en el JSON del escenario.

Ejemplo:

`pnpm --filter @betting-engine/simulator simulate -- --scenario scenarios/multi-competitions/match-1.json --speed 60x`

Comportamiento esperado en corridas repetidas:

- Si corres el mismo escenario varias veces sin cambiar el JSON, reutilizas el mismo `matchId`.
- Si el partido ya esta en estado `FINISHED`, `odds-engine` no vuelve a persistir nuevos eventos para ese partido.
- Este modo es util para reintentar un mismo timeline de partido.

### Modo fresh match ids

Genera nuevos `matchId` en memoria en cada corrida, sin modificar archivos de escenario.

Ejemplo:

`pnpm --filter @betting-engine/simulator simulate -- --scenario scenarios/multi-competitions/match-1.json --speed 60x --fresh-match-ids`

Comportamiento esperado en corridas repetidas:

- Cada corrida crea partidos nuevos (IDs distintos).
- Puedes ejecutar el mismo escenario muchas veces para pruebas de carga o volumen sin editar JSON.
- El CLI imprime el remapeo `old -> new` para trazabilidad.

## Recomendaciones de uso

- Usa modo normal cuando quieras depurar un partido puntual con ID estable.
- Usa `--fresh-match-ids` cuando quieras ejecutar multiples corridas consecutivas sin colisiones por `matchId`.
- Para escenarios compuestos (arreglo de escenarios), el remapeo se aplica a cada escenario del archivo.

## Variables de entorno

- `KAFKA_BROKERS` o `KAFKA_BROKER` (default: `localhost:9092`)
- `KAFKA_MATCH_EVENTS_TOPIC` (default: `match.events`)
- `KAFKA_CLIENT_ID` (default: `simulator-cli`)

## Notas de alcance

- Este simulador solo publica en Kafka.
- No consume topics ni accede a base de datos.
- No implementa API Gateway ni HMAC en esta fase.

## Verificación rápida

- Ejecutar tests:

```
pnpm --filter @betting-engine/simulator test
```

- Tipo-check y build:

```
pnpm --filter @betting-engine/simulator typecheck
pnpm --filter @betting-engine/simulator build
```

- Ejecutar con infra levantada (esperar `pnpm docker:ps` healthy):

```
pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x
```

