# Resumen - Fase 7 (Bet Service - Publicación de Apuestas y Endpoints Internos)

Fecha: 2026-04-22 (actualizado 2026-04-23)

## Objetivo

Completar el flujo de apuesta del Bet Service adicionando:
1. Publicación de evento `bet.placed` a Kafka para Settlement
2. Endpoints internos para que Settlement consuma apuestas y las-liquide

## Lo Implementado

### 1. Kafka Client en Bet Service

**Archivo**: `apps/bet-service/src/app.module.ts`

```typescript
ClientsModule.register([
  {
    name: 'KAFKA_CLIENT',
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
      },
      producer: { allowAutoTopicCreation: false },
    },
  },
]),
```

### 2. Publicación de Evento bet.placed

**Archivo**: `apps/bet-service/src/application/use-cases/place-bet.use-case.ts`

```typescript
constructor(
  ...
  @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka | undefined,
) {}

private async publishBetPlacedEvent(bet: Bet): Promise<void> {
  if (!this.kafkaClient) {
    this.logger.warn('Kafka client not available, skipping bet.placed event');
    return;
  }
  const event = { ... };
  this.kafkaClient.emit('bet.placed', { key: bet.userId, value: event });
}
```

**Nota**: Kafka client es opcional para evitar errores si Kafka no está disponible.

### 3. InternalBetsController (para Settlement)

**Archivo**: `apps/bet-service/src/interface/http/internal-bets.controller.ts`

```typescript
@Controller('internal')
export class InternalBetsController {
  @Get('bets')
  async getBets(
    @Query('matchId') matchId?: string,
    @Query('status') status?: BetStatus,
  ): Promise<Bet[]>

  @Patch('bets/:betId/settle')
  async settleBet(
    @Param('betId') betId: string,
    @Body() dto: SettleBetDto,
  ): Promise<{ message: string }>
}
```

### 4. Nuevos Métodos en BetRepository

**Puerto**: `apps/bet-service/src/domain/ports/bet-repository.port.ts`

```typescript
findByMatch(matchId: string): Promise<Bet[]>;
findPendingByMatch(matchId: string, status: BetStatus): Promise<Bet[]>;
settleBet(betId: string, status: BetStatus, payoutCents: number): Promise<void>;
```

**Implementación**: `postgres-bet.repository.ts`

### 5. Nuevo Métodos en UserRepository

**Puerto**: `apps/bet-service/src/domain/ports/user-repository.port.ts`

```typescript
findById(id: string): Promise<{ id: string; balanceCents: number; createdAt: Date } | null>;
deductBalance(userId: string, amountCents: number): Promise<boolean>;
creditBalance(userId: string, amountCents: number): Promise<boolean>;
save(user: { id: string; balanceCents: number }): Promise<void>;
```

### 6. Entity Actualizada

**Archivo**: `apps/bet-service/src/domain/entities/bet.entity.ts`

```typescript
export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  selection: BetSelection;
  acceptedOdds: number;
  stakeCents: number;
  payoutCents?: number;  // NUEVO
  status: BetStatus;
  createdAt: Date;
}
```

### 7. Manejo de Errores

**BetsController**:

```typescript
@Post()
async placeBet(@Body() body: {...}): Promise<PlaceBetOutput> {
  try {
    return await this.placeBetUseCase.execute(body);
  } catch (error: any) {
    this.logger.error(`Error placing bet: ${error?.message || error}`);
    return { success: false, error: 'Unable to process bet. Please try again.' };
  }
}
```

**InternalBetsController**:

- `GET /internal/bets`: Retorna `[]` si falta `matchId` o hay error
- `PATCH /internal/bets/:id/settle`: Lanza `404 NotFoundException` si no existe la apuesta
- Excepciones atrapadas con logs apropiados

### 8. Fixes de Inyección de Dependencias

**BetsController**:
```typescript
constructor(
  @Inject(PlaceBetUseCase) private readonly placeBetUseCase: PlaceBetUseCase,  // @Inject requerido
  @Inject(BET_REPOSITORY_PORT) private readonly betRepository: BetRepositoryPort,
) {}
```

**Repositories**:
```typescript
constructor(
  @InjectDataSource() private readonly dataSource: DataSource,  // @InjectDataSource de @nestjs/typeorm
) {}
```

## Estado Verificado

| Componente | Estado |
|-----------|--------|
| `GET /matches/live` | ✅ Verificado |
| `POST /bets` | ✅ Verificado |
| Saldo deduce correctamente | ✅ Verificado |
| `GET /internal/bets?matchId&status` | ✅ Verificado |
| `PATCH /internal/bets/:id/settle` | ✅ Verificado |
| Kafka publish | ⚠️ Opcional (silencia warning si no hay Kafka) |

## Pendiente / Limitaciones

- ❌ Recarga de saldo (no está en scope - requeriría integration con sistema de pagos externo)
- ❌ Sistema de usuarios (asumido pre-creado con saldo demo de $1,000)
- ❌ Validación de cuotas (slippage tolerance no implementada)
- ⚠️ Kafka publish es opcional - en production debería ser requerido

## Verificación y Uso

```bash
# Consultar partidos vivos
curl http://localhost:3002/matches/live

# Crear apuesta
curl -X POST http://localhost:3002/bets \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid","matchId":"uuid","selection":"HOME","stakeCents":1000}'

# Endpoint interno para Settlement
curl "http://localhost:3002/internal/bets?matchId={matchId}&status=OPEN"

# Liquidar apuesta
curl -X PATCH http://localhost:3002/internal/bets/{betId}/settle \
  -H "Content-Type: application/json" \
  -d '{"result":"HOME_WIN"}'
```

Checks operativos:

- `pnpm --filter @betting-engine/bet-service typecheck` — pasa
- `pnpm --filter @betting-engine/bet-service build` — compila

## Archivos Modificados/Agregados

- `apps/bet-service/src/app.module.ts`
- `apps/bet-service/src/application/use-cases/place-bet.use-case.ts`
- `apps/bet-service/src/interface/http/bets.controller.ts` — manejo de errores agregado
- `apps/bet-service/src/interface/http/internal-bets.controller.ts` — NUEVO
- `apps/bet-service/src/domain/ports/bet-repository.port.ts`
- `apps/bet-service/src/domain/ports/user-repository.port.ts`
- `apps/bet-service/src/domain/entities/bet.entity.ts`
- `apps/bet-service/src/infrastructure/adapters/outbound/postgres/postgres-bet.repository.ts`
- `apps/bet-service/src/infrastructure/adapters/outbound/postgres/postgres-user.repository.ts`
- `apps/bet-service/src/database/migrations/1710000000002-InitBetServiceSchema.ts`

## Flujo Completo

```
1. Usuario crea apuesta → POST /bets
2. PlaceBetUseCase valida usuario, odds, saldo
3. Deduce stake del balance del usuario
4. Guarda apuesta en PostgreSQL (status=OPEN)
5. Publica evento bet.placed a Kafka (opicional)
6. Settlement consume evento (Fase 8)
7. MATCH_END → Settlement llama GET /internal/bets?matchId&status=OPEN
8. Settlement evalua resultado → PATCH /internal/bets/:id/settle
9. Bet Service actualiza status (WON/LOST) y acredita ganancias
```

## Siguientes Pasos

- **Fase 8**: Implementar Settlement service (consume bet.placed + match.events MATCH_END)