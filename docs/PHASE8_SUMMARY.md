# Resumen - Fase 8 (Settlement Service - Liquidación de Apuestas)

Fecha: 2026-04-23

## Objetivo

Implementar el Settlement Service que consume eventos de fin de partido y liquida las apuestas automaticamente, acreditando ganancias a los usuarios.

## Lo Implementado

### 1. Arquitectura General

```
MATCH_END (Kafka) ──► Settlement Service ──► HTTP ──► Bet Service
       │                                          │
       │                                    GET /internal/bets
       │                                          │
       │                                    PATCH /internal/bets/:id/settle
       │                                          │
       ▼                                          ▼
   processed_matches                          bet_service.bets
   (evita duplicados)                         (actualiza status WON/LOST)
       │
       ▼
   bet.settled (Kafka) ──► Notificaciones futuras
```

### 2. MatchEventsConsumer

**Archivo**: `apps/settlement/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts`

```typescript
@Controller()
export class MatchEventsConsumer {
  @EventPattern('match.events')
  async handleMatchEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext) {
    // Solo procesa MATCH_END
    // Verifica si match ya fue procesado
    // Invoca SettleMatchUseCase
  }
}
```

**Filtros aplicados:**
- Ignora MATCH_START, GOAL, YELLOW_CARD, RED_CARD
- Valida UUID del matchId
- Verifica idempotencia con `processed_matches`

### 3. BetPlacedConsumer

**Archivo**: `apps/settlement/src/infrastructure/adapters/inbound/kafka/bet-placed.consumer.ts`

```typescript
@Injectable()
export class BetPlacedConsumer {
  @EventPattern('bet.placed')
  async handleBetPlaced(@Payload() payload: unknown, @Ctx() context: KafkaContext) {
    // Cachea apuestas pendientes por matchId (in-memory)
    // Disponible para uso futuro si se requiere
  }
}
```

**Nota**: Implementado para mantener consistencia con el flujo. Actualmente Settlement consulta directamente a Bet Service via HTTP.

### 4. SettleMatchUseCase

**Archivo**: `apps/settlement/src/application/use-cases/settle-match.use-case.ts`

```typescript
@Injectable()
export class SettleMatchUseCase {
  async execute(input: SettleMatchInput): Promise<SettleMatchOutput> {
    // 1. Obtiene apuestas OPEN del Bet Service
    // 2. Evalua cada apuesta contra resultado
    // 3. Llama PATCH /internal/bets/:id/settle
    // 4. Publica bet.settled a Kafka
    // 5. Retorna resumen de liquidation
  }

  private evaluateBet(bet: BetServiceBet, result: MatchResult): BetSettlementStatus {
    const won =
      (bet.selection === 'HOME' && result === 'HOME_WIN') ||
      (bet.selection === 'DRAW' && result === 'DRAW') ||
      (bet.selection === 'AWAY' && result === 'AWAY_WIN');
    return won ? 'WON' : 'LOST';
  }
}
```

### 5. BetServiceHttpClient

**Archivo**: `apps/settlement/src/infrastructure/adapters/outbound/http/bet-service-http.client.ts`

```typescript
@Injectable()
export class BetServiceHttpClient {
  async getBetsForMatch(matchId: string, status: string): Promise<BetServiceBet[]>
  async settleBet(betId: string, result: MatchResult): Promise<boolean>
}
```

**Token de inyección**: `BET_SERVICE_HTTP_CLIENT` (evita problemas de inyección por tipo)

**Uso de axios directo**: Implementado sin @nestjs/axios para mayor robustez

### 6. ProcessedMatchRepository

**Archivo**: `apps/settlement/src/infrastructure/adapters/outbound/postgres/processed-match.repository.ts`

```typescript
@Injectable()
export class ProcessedMatchRepository {
  async exists(matchId: string): Promise<boolean>
  async save(matchId: string): Promise<void>
}
```

**Propósito**: Garantizar que cada partido se liquida exactamente una vez.

### 7. Migraciones Automáticas

**Archivo**: `apps/settlement/src/main.ts`

```typescript
async function runMigrations(): Promise<void> {
  const dataSource = new DataSource({ schema: 'settlement', ... });
  await dataSource.initialize();
  if (await dataSource.showMigrations()) {
    await dataSource.runMigrations();
  }
  await dataSource.destroy();
}
```

### 8. Kafka Producer

El Settlement Service tiene un `KAFKA_CLIENT` configurado como producer para publicar eventos `bet.settled`.

```typescript
this.kafkaClient.emit('bet.settled', {
  key: event.userId,
  value: event,
});
```

## Estructura de Archivos

```
apps/settlement/src/
├── main.ts
├── app.module.ts
├── health.controller.ts
├── application/use-cases/
│   └── settle-match.use-case.ts
├── domain/ports/
│   └── processed-match-repository.port.ts
├── infrastructure/
│   ├── adapters/inbound/kafka/
│   │   ├── match-events.consumer.ts
│   │   └── bet-placed.consumer.ts
│   └── adapters/outbound/
│       ├── http/
│       │   └── bet-service-http.client.ts
│       └── postgres/
│           └── processed-match.repository.ts
└── database/
    ├── data-source.ts
    └── migrations/
        └── 1710000000003-InitSettlementSchema.ts
```

## Configuración de Kafka

```typescript
app.connectMicroservice({
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'settlement',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    },
    consumer: {
      groupId: 'settlement-consumer',
      allowAutoTopicCreation: false,
    },
    subscribe: {
      fromBeginning: false,
    },
  },
});
```

## Verificación y Uso

```bash
# Verificar salud
curl http://localhost:3003/health

# Ver partidos procesados
docker exec bet_engine-postgres-1 psql -U postgres -d betting_engine -c "SELECT * FROM settlement.processed_matches;"

# Ver apuestas de un usuario
curl http://localhost:3002/bets/user/{userId}

# Verificar bet.settled en Kafka
docker exec bet_engine-kafka-1 kafka-console-consumer --bootstrap-server localhost:9092 --topic bet.settled --from-beginning
```

## Flujo End-to-End Completo

```
1. Simulador ──► match.events (MATCH_START)
2. Odds Engine ──► Procesa, publica odds.updated
3. Usuario ──► GET /matches/live (ve cuotas)
4. Usuario ──► POST /bets (crea apuesta)
5. Bet Service ──► Valida, deduce saldo, guarda
6. Bet Service ──► bet.placed (Kafka)
7. Bet Service ──► PATCH /internal/bets/:id/settle
8. Settlement ──► consume MATCH_END
9. Settlement ──► GET /internal/bets?status=OPEN
10. Settlement ──► Evalúa resultado
11. Settlement ──► PATCH /internal/bets/:id/settle
12. Settlement ──► publish bet.settled
13. Bet Service ──► Actualiza WON/LOST, acredita ganancias
14. Settlement ──► save processed_matches
```

## Comandos de Verificación

```bash
# 1. Levantar infraestructura
pnpm docker:up

# 2. Levantar servicios
pnpm --filter @betting-engine/odds-engine dev &
pnpm --filter @betting-engine/bet-service dev &
pnpm --filter @betting-engine/settlement dev &

# 3. Ejecutar simulador
pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids

# 4. Crear apuesta (capturar matchId del simulador)
curl -X POST http://localhost:3002/bets -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","matchId":"AQUI_MATCHID","selection":"HOME","stakeCents":1000}'

# 5. Verificar liquidación en logs de Settlement
```

## Verificaciones de Calidad

- `pnpm --filter @betting-engine/settlement typecheck` - ✅ OK
- `pnpm --filter @betting-engine/settlement build` - ✅ OK

## Mejoras Futuras Consideradas

- [ ] Implementar tabla `transactions` para auditoría de saldo (ledger pattern)
- [ ] Agregar endpoint de historial de liquidaciones
- [ ] Retry logic para fallos temporales de HTTP
- [ ] Dead Letter Queue para eventos fallidos

## Errores Corregidos Durante Implementación

1. **BetPlacedConsumer en controllers** - `@Injectable()` debe estar en providers
2. **Inyección HttpService** - Usado `axios` directo en lugar de `@nestjs/axios`
3. **Token de inyección BET_SERVICE_HTTP_CLIENT** - Evita conflictos de tipo
4. **DTO payoutCents** - Bet Service solo espera `result`, no `payoutCents`
5. **Columna payout_cents** - Agregada migration y ejecutada manualmente

## Estado

| Componente | Estado |
|-----------|--------|
| MATCH_END consumer | ✅ Implementado |
| bet.placed consumer | ✅ Implementado |
| SettleMatchUseCase | ✅ Implementado |
| HTTP client a Bet Service | ✅ Implementado |
| processed_matches | ✅ Implementado |
| bet.settled publishing | ✅ Implementado |
| Migraciones auto | ✅ Implementado |
| Typecheck/Build | ✅ Passing |