# Cronología de Implementación del Betting Engine

## Propósito de Este Documento

Este documento sirve como guía detallada para comprender cómo se construye progresivamente el sistema de apuestas deportivas en tiempo real. Cada sección corresponde a una fase de implementación que se construye sobre las anteriores, creando una cadena de dependencias lógicas donde cada componente sabe qué esperar de los anteriores y qué proporcionar a los siguientes.

El sistema está diseñado con una arquitectura hexagonal donde el dominio nunca conoce los detalles de infraestructura. Esta cronología respeta ese principio: se implementa primero la infraestructura base, luego los servicios de dominio, y finalmente las conexiones entre ellos mediante Kafka.

**Framework Base**: Todos los servicios se implementan con **NestJS** (`@nestjs/core`), aprovechando su sistema de módulos, inyección de dependencias y soporte nativo para microservicios.

---

## Visión General del Sistema

### Los Cuatro Pilares del Sistema

El Betting Engine se compone de cuatro servicios independientes construidos con NestJS: una **API Gateway** y tres microservicios que se comunican exclusivamente mediante eventos de Kafka:

| Servicio | Framework | Responsabilidad Principal | Entrada | Salida |
|----------|-----------|---------------------------|---------|--------|
| **api-gateway** | NestJS | Punto único de entrada, autenticación, rate limiting | Peticiones HTTP/WebSocket de clientes | Proxy a microservicios |
| **odds-engine** | NestJS | Calcula cuotas en tiempo real | Eventos de partido del simulador | Cuotas actualizadas a Redis y Kafka |
| **bet-service** | NestJS | Gestiona el catálogo de partidos y el registro de apuestas | Cuotas de Redis, eventos de Kafka | Apuestas registradas publicadas a Kafka |
| **settlement** | NestJS | Liquida las apuestas cuando termina un partido | Eventos de fin de partido y apuestas | Pagos acreditados, eventos de liquidación |

### ¿Por Qué NestJS?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DECISIÓN: NESTJS COMO FRAMEWORK                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ARQUITECTURA HEXAGONAL                                               │
│  ├── @Module()        → Organiza código en capas                      │
│  ├── @Injectable()    → Inyección de dependencias                     │
│  ├── @Inject()        → Puertos e interfaces                          │
│  └── providers: []    → Registro de adaptadores                       │
│                                                                         │
│  MICROSERVICIOS                                                       │
│  ├── @nestjs/microservices → Abstracción sobre transportes            │
│  ├── Transport.KAFKA       → Comunicación asíncrona                   │
│  ├── @EventPattern()       → Consumo de eventos                       │
│  └── client.emit()         → Publicación de eventos                   │
│                                                                         │
│  API GATEWAY                                                          │
│  ├── @Controller()         → Endpoints HTTP                           │
│  ├── @WebSocketGateway()   → Streaming en tiempo real                 │
│  ├── Middleware            → Auth, Rate Limiting                      │
│  └── Guards/Interceptors   → Cross-cutting concerns                   │
│                                                                         │
│  TESTING                                                              │
│  ├── Test.createTestingModule() → Tests unitarios                     │
│  ├── TestContainers             → Tests de integración                │
│  └── @nestjs/testing            → Mocks y utilities                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Principio Fundamental: Sin Comunicación Directa Cliente-Microservicios

**Los clientes NUNCA se comunican directamente con los microservicios.** Toda comunicación pasa obligatoriamente por la API Gateway, que actúa como:
- **Fachada única**: Un solo punto de entrada para todos los clientes
- **Guardián de seguridad**: Autenticación y autorización centralizada
- **Protector de recursos**: Rate limiting para prevenir sobrecarga
- **Enrutador inteligente**: Direcciona peticiones al servicio correcto

### Flujo de Datos en Tiempo Real

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE DATOS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CLIENTES                                                                  │
│      │                                                                      │
│      │ HTTP / WebSocket                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         API GATEWAY (NestJS)                         │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│   │  │ @Module()   │  │ Middleware  │  │ @Controller │  │ @WebSocket  │ │  │
│   │  │ Config      │  │ Stack       │  │ Routing     │  │ Gateway     │ │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│   │                                                                     │  │
│   │  @nestjs/common, @nestjs/websockets, @nestjs/jwt, @nestjs/axios    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│           ┌────────────────────────┼────────────────────────┐              │
│           │                        │                        │              │
│           ▼                        ▼                        ▼              │
│   ┌─────────────────┐      ┌─────────────┐      ┌─────────────────┐       │
│   │ Odds Engine     │      │ Bet Service │      │   Settlement    │       │
│   │ (NestJS)        │      │  (NestJS)   │      │   (NestJS)      │       │
│   │                 │      │             │      │                 │       │
│   │ @nestjs/        │      │ @nestjs/    │      │ @nestjs/        │       │
│   │ microservices   │      │ microservices│      │ microservices   │       │
│   │ Transport.KAFKA │      │ Transport.  │      │ Transport.KAFKA │       │
│   │                 │      │ KAFKA       │      │                 │       │
│   └──────┬──────────┘      └──────┬──────┘      └─────────────────┘       │
│          │                        │                 │                      │
│          │                        │                 │                      │
│          └────────────────────────┼─────────────────┘                      │
│                                   │                                        │
│                              Kafka Events                                  │
│                         @nestjs/microservices                              │
│                                                                             │
│   ┌─────────────┐                                                           │
│   │  Simulador  │ ──────────────────────► match.events                      │
│   │     CLI     │                                                           │
│   └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Esta visualización del flujo muestra un principio fundamental: **no existe comunicación síncrona entre servicios excepto Settlement → Bet Service para liquidación**, y esa comunicación usa HTTP interno, nunca acceso directo a bases de datos cruzadas. Los clientes solo ven la API Gateway.

---

## Fase 0: Shared Kernel — El Contrato Compartido

### Qué Es y Por Qué Va Primero

El paquete `shared-kernel` es la única dependencia que comparten los cuatro servicios NestJS. Contiene exclusivamente tipos TypeScript e interfaces, sin ninguna lógica de negocio ni dependencias de infraestructura. Su propósito es definir un contrato que todos los servicios respetan: los eventos de Kafka, las estructuras de datos y las interfaces de los adaptadores.

La razón por la cual este componente se implementa antes que cualquier otro es puramente lógica: si los cuatro servicios van a comunicarse mediante eventos, primero deben ponerse de acuerdo sobre cómo son esos eventos. Sin un contrato compartido, cada servicio podría interpretar los datos de manera diferente, causando bugs sutiles y difíciles de detectar.

### Estructura del Contrato

El contrato se divide en tres categorías de eventos y una interfaz de proveedor de datos:

#### Eventos de Partido

Los eventos de partido representan todo lo que ocurre durante un encuentro deportivo. El simulador los genera y los publica al topic `match.events`, donde son consumidos por el odds-engine y el settlement simultáneamente.

```typescript
// packages/shared-kernel/src/events/match.events.ts
export type MatchEventType = 
  | 'MATCH_START' 
  | 'GOAL' 
  | 'YELLOW_CARD' 
  | 'RED_CARD' 
  | 'MATCH_END';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  timestamp: string;
  payload: GoalPayload | MatchEndPayload | null;
}
```

Cada tipo de evento tiene un payload específico que varía según la naturaleza del evento. Por ejemplo, un gol incluye el minuto, el equipo marcador y el marcador actualizado, mientras que un partido terminado incluye el resultado final precalculado.

#### Eventos de Apuesta

Cuando un usuario registra una apuesta, el bet-service publica un evento `BetPlacedEvent` al topic `bet.placed`. Este evento contiene toda la información necesaria para que Settlement procese la liquidación posteriormente: el identificador de la apuesta, el usuario, el partido, la selección del usuario y la cuota aceptada en el momento de la apuesta.

```typescript
// packages/shared-kernel/src/events/bet.events.ts
export interface BetPlacedEvent {
  betId: string;
  userId: string;
  matchId: string;
  selection: 'HOME' | 'DRAW' | 'AWAY';
  acceptedOdds: number;
  stakeCents: number;
  timestamp: string;
}
```

#### Eventos de Cuotas

Cuando el odds-engine recalcula las cuotas tras un evento relevante, publica un `OddsUpdatedEvent` al topic `odds.updated`. Este evento es consumido por el bet-service para actualizar su caché local de cuotas y garantizar que el usuario ve siempre valores actualizados.

```typescript
// packages/shared-kernel/src/events/odds.events.ts
export interface OddsSnapshot {
  home: number;
  draw: number;
  away: number;
  timestamp: string;
}

export interface OddsUpdatedEvent {
  matchId: string;
  odds: OddsSnapshot;
  triggeredByEventId: string;
}
```

### Conexión con las Fases Siguientes

El shared-kernel no produce ningún comportamiento observable por sí mismo. Su única función es proporcionar las definiciones de tipos que se importan en los cuatro servicios NestJS. Sin embargo, cualquier cambio en estos tipos afecta directamente a todos los servicios, por lo que es crucial que el contrato esté completo y estable antes de comenzar la implementación de los servicios.

La verificación de esta fase es simple: ejecutar `tsc` en el paquete shared-kernel y confirmar que compila sin errores. Este paso se convierte en el punto de referencia para verificar que los tipos están correctamente definidos antes de que los servicios comiencen a depender de ellos.

---

## Fase 1: Infraestructura Base — Docker Compose

### Objetivo de Esta Fase

El objetivo de esta fase es crear un entorno de desarrollo reproducible donde toda la infraestructura necesaria esté disponible con un solo comando. Esta fase implementa la historia de usuario HU-001 y establece las bases sobre las cuales se construirá todo lo demás.

La importancia de esta fase trasciende la mera conveniencia. En un sistema distribuido con múltiples servicios NestJS, bases de datos y brokers de mensajes, la complejidad de configuración puede convertirse en un obstáculo mayor que la lógica de negocio misma. Al centralizar toda la configuración en docker-compose, eliminamos esa fricción y permitimos que los desarrolladores se concentren en lo que realmente importa.

### Componentes de la Infraestructura

#### Apache Kafka

Kafka es el backbone de comunicación asíncrona entre servicios NestJS. Cada servicio funciona como un consumidor o productor de eventos, y Kafka garantiza la entrega incluso ante fallos temporales de los consumidores. La configuración incluye cinco topics especializados:

El topic `match.events` recibe todos los eventos generados por el simulador. Se configura con seis particiones para permitir consumo paralelo por parte del odds-engine y el settlement. El orden de mensajes está garantizado dentro de cada partición, y la clave de partición es el matchId, asegurando que todos los eventos de un mismo partido lleguen al mismo consumer group en orden.

El topic `odds.updated` recibe las cuotas recalculadas por el odds-engine. El bet-service lo consume para mantener su caché local actualizado. La alta frecuencia de actualización de cuotas justifica las seis particiones para distribuir la carga.

El topic `bet.placed` recibe las apuestas registradas por los usuarios. Con doce particiones, es el topic de mayor throughput del sistema. La clave de partición es el userId, lo que permite a Settlement procesar las apuestas de cada usuario de manera correlacionada.

El topic `bet.settled` recibe los eventos de liquidación. Es consumido por un servicio futuro de notificaciones. El topic `bet.placed.dlq` actúa como Dead Letter Queue para mensajes que fallaron repetidamente.

#### PostgreSQL

PostgreSQL sirve como base de datos para los tres microservicios NestJS, cada uno con su propio schema en la misma instancia. Esta separación permite que cada servicio mantenga su propia proyección de los datos sin conocer la estructura interna de los demás.

El schema `odds_engine` almacena el estado de los partidos y el log de eventos procesados. La tabla `matches` mantiene la visión actual de cada partido, mientras que `match_event_log` registra todos los eventos recibidos para soportar idempotencia.

El schema `bet_service` almacena usuarios con su saldo y apuestas con su estado. La tabla `users` inicializa a cada usuario con un saldo de demostración de mil dólares.

El schema `settlement` es deliberadamente mínimo: solo la tabla `processed_matches` para garantizar que cada partido se liquida exactamente una vez.

#### Redis

Redis actúa como caché de cuotas de baja latencia. Cuando el odds-engine recalcula cuotas, las escribe en Redis con una clave estructurada como `odds:{matchId}` y un TTL de trescientos segundos. El bet-service consulta Redis para obtener cuotas al consultar partidos en vivo, evitando llamadas síncronas al odds-engine.

### Secuencia de Arranque

La secuencia de arranque de los contenedores está cuidadosamente ordenada para garantizar que cada servicio NestJS encuentra sus dependencias disponibles al iniciar:

Primero, Zookeeper inicia y expone el servicio de coordinación requerido por Kafka. Segundo, Kafka inicia y espera a que Zookeeper esté respondiendo antes de iniciar sus listeners. Tercero, el servicio `kafka-setup` espera a que Kafka esté completamente disponible y luego crea todos los topics con sus particiones y configuraciones.

Cuarto, PostgreSQL inicia y crea la base de datos. Cada servicio NestJS ejecuta sus propias migraciones al iniciar, creando los schemas y tablas necesarios. Quinto, Redis inicia con configuración de memoria máxima y política de expulsión. Finalmente, los servicios de aplicación NestJS inician solo después de que todas sus dependencias reporten estado saludable.

### Verificación de la Fase

La verificación de esta fase confirma que todos los componentes están operativos y configurados correctamente. El comando `docker-compose ps` debe mostrar todos los servicios con estado healthy. La ejecución de `kafka-topics --list --bootstrap-server localhost:9092` debe listar los cinco topics esperados. La conexión a PostgreSQL con `psql` debe permitir acceso a la base de datos `betting_engine`. La ejecución de `redis-cli ping` debe retornar `PONG`.

Esta fase no produce código de dominio funcional, pero establece el entorno donde todo lo demás se ejecutará. Sin esta base sólida, las fases posteriores serían imposibles de verificar de manera confiable.

---

## Fase 2: Odds Engine — Consumo de Eventos de Partido

### Objetivo de Esta Fase

Esta fase implementa la HU-002 y representa el primer código de dominio funcional del sistema. El odds-engine debe consumir eventos del topic `match.events`, procesarlos según su tipo y persistir el estado actualizado del partido en PostgreSQL.

La responsabilidad del odds-engine en esta fase es exclusivamente de persistencia: actualizar el marcador, el minuto actual y el estado del partido. El cálculo de cuotas se implementa en la siguiente fase. Esta separación permite verificar que el consumo de eventos y la persistencia funcionan correctamente antes de añadir lógica de negocio adicional.

### Arquitectura Hexagonal del Odds Engine con NestJS

El dominio del odds-engine conoce únicamente interfaces abstractas, nunca implementaciones concretas. El puerto `MatchRepositoryPort` define las operaciones de persistencia, y el adaptador `PostgresMatchRepository` proporciona la implementación real usando TypeORM. Esta separación permite testear la lógica de dominio sin necesidad de una base de datos real.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Odds Engine (NestJS)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Domain Layer                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Match Entity                                                          │ │
│  │ - id, homeTeam, awayTeam, homeScore, awayScore, status, currentMinute │ │
│  │                                                                       │ │
│  │ MatchRepositoryPort (interface)                                       │ │
│  │ - findById(), save(), update()                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Application Layer                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ ProcessMatchEventUseCase (@Injectable)                                │ │
│  │ - Recibe MatchEvent del consumer                                      │ │
│  │ - Valida idempotencia                                                 │ │
│  │ - Actualiza estado del partido                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Infrastructure Layer                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PostgresMatchRepository (@Injectable)                                 │ │
│  │ implements MatchRepositoryPort usando TypeORM                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Interface Layer                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ MatchEventsConsumer (@Controller)                                     │ │
│  │ @EventPattern('match.events')                                         │ │
│  │ - Suscrito a match.events                                             │ │
│  │ - Transforma mensajes a MatchEvent                                    │ │
│  │ - Invoca ProcessMatchEventUseCase                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  odds-engine.module.ts                                                      │
│  ├── @Module({ imports: [TypeOrmModule], controllers: [MatchEventsConsumer] │
│  └── providers: [ProcessMatchEventUseCase, { provide: 'MatchRepositoryPort' │
│                                               useClass: PostgresMatchRepository }]
│                                                                             │
│  main.ts                                                                    │
│  ├── app = NestFactory.create(OddsEngineModule)                           │
│  ├── app.connectMicroservice({ transport: Transport.KAFKA })              │
│  └── app.startAllMicroservices()                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuración del Microservicio NestJS

```typescript
// apps/odds-engine/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OddsEngineModule } from './odds-engine.module';

async function bootstrap() {
  // Crear aplicación híbrida: HTTP + Microservicio Kafka
  const app = await NestFactory.create(OddsEngineModule);
  
  // Configurar microservicio Kafka
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      },
      consumer: {
        groupId: 'odds-engine-consumer',
        allowAutoTopicCreation: false,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });
  
  // Iniciar ambos: HTTP server y Kafka consumer
  await app.startAllMicroservices();
  await app.listen(3001);
  
  console.log(`Odds Engine HTTP running on port 3001`);
  console.log(`Odds Engine Kafka consumer started`);
}

bootstrap();
```

### Consumer de Kafka en NestJS

```typescript
// apps/odds-engine/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts
import { Controller, Logger } from '@nestjs/common';
import { 
  EventPattern, 
  Payload, 
  Ctx, 
  KafkaContext,
} from '@nestjs/microservices';
import { ProcessMatchEventUseCase } from '../../application/use-cases/process-match-event.use-case';
import { MatchEvent } from '@betting-engine/shared-kernel';

@Controller()
export class MatchEventsConsumer {
  private readonly logger = new Logger(MatchEventsConsumer.name);
  
  constructor(
    private readonly processMatchEventUseCase: ProcessMatchEventUseCase,
  ) {}
  
  @EventPattern('match.events')
  async handleMatchEvent(
    @Payload() event: MatchEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const { offset, partition, topic } = context.getMessage();
    
    this.logger.log(
      `Processing event from ${topic}[${partition}]@${offset}: ${event.type}`,
    );
    
    await this.processMatchEventUseCase.execute(event);
  }
}
```

### Módulo NestJS

```typescript
// apps/odds-engine/src/odds-engine.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [MatchEntity, MatchEventLogEntity],
      synchronize: false,  // Usar migraciones en producción
    }),
  ],
  controllers: [
    MatchEventsConsumer,
    HealthController,
  ],
  providers: [
    ProcessMatchEventUseCase,
    {
      provide: 'MatchRepositoryPort',
      useClass: PostgresMatchRepository,
    },
  ],
})
export class OddsEngineModule {}
```

### Flujo de Procesamiento de Eventos

Cuando el simulador publica un evento al topic `match.events`, el flujo de procesamiento es el siguiente:

El consumidor de Kafka (`MatchEventsConsumer`) recibe el mensaje y lo deserializa a un objeto `MatchEvent`. El caso de uso intenta registrar el evento en `match_event_log` usando la clave `(provider, provider_event_id)` en una transacción. Si el registro no se inserta (por duplicado o por regla de partido finalizado), se considera `DUPLICATE` y no se procesa estado.

Para `MATCH_START`, crea/actualiza el partido a estado `LIVE` con marcador inicial. Para `GOAL` y eventos de tarjeta, actualiza minuto y marcador con semántica monotónica (no regresiva). Para `MATCH_END`, cambia estado a `FINISHED` y consolida resultado final también con semántica monotónica.

Además, existe una guardia de consistencia en persistencia: si el partido ya está `FINISHED`, no se aceptan nuevos eventos para ese `matchId`.

### Mecanismo de Idempotencia

La idempotencia es crítica en sistemas basados en eventos porque Kafka ofrece semantics de al menos una entrega. Un mensaje puede ser entregado más de una vez en situaciones de red inestable, reinicio de consumer, o rebalanceo del consumer group.

El mecanismo de idempotencia del odds-engine utiliza una constraint de unicidad en la base de datos. La tabla `match_event_log` tiene una PK en la combinación `(provider, provider_event_id)` y se usa `ON CONFLICT DO NOTHING` para tratar duplicados de forma segura.

Como protección adicional, el insert de `match_event_log` es condicional al estado del partido: si ya está `FINISHED`, no inserta ni procesa el evento. Esto evita reprocesamiento tardío tras cierre de partido.

Para eventos fuera de orden o reemitidos con payload antiguo, el estado del partido se protege con actualización monotónica (`Math.max` sobre `currentMinute`, `homeScore`, `awayScore`), evitando regresiones del marcador o minuto.

### Verificación de la Fase

Para verificar que esta fase funciona correctamente, se publica manualmente un evento al topic `match.events` usando la herramienta `kafka-console-producer`. Tras la publicación, se verifica en PostgreSQL que la fila correspondiente existe en la tabla `odds_engine.matches` con los valores correctos.

La verificación de idempotencia se realiza publicando el mismo evento una segunda vez. La segunda publicación no debe aumentar filas en `match_event_log` para la misma clave `(provider, provider_event_id)`, y el estado del partido debe permanecer sin cambios.

Los tests unitarios verifican el `ProcessMatchEventUseCase` con mocks del repositorio, confirmando que los tres tipos de evento actualizan el estado correctamente.

---

## Fase 3: Odds Engine — Cálculo y Publicación de Cuotas

### Estado de Implementación (2026-04-19)

HU-003 se encuentra implementada en `odds-engine` con una version operativa del flujo completo:

- `ProcessMatchEventUseCase` retorna resultado estructurado (`processed` o `duplicate`) junto al estado del partido cuando aplica.
- `MatchEventsConsumer` solo dispara recálculo/publicación cuando el evento fue `processed`.
- `RecalculateOddsUseCase` calcula cuotas y publica en paralelo a Redis y Kafka.
- `OddsCalculatorService` aplica modelo simplificado documentado (base + score/time factor + vig).
- `RedisKafkaOddsPublisher` publica:
  - Redis key `odds:{matchId}` con TTL configurable.
  - Kafka topic `odds.updated` con `matchId` como key de particionamiento.
- Resiliencia de publicación implementada con reintentos por destino y resultado agregado:
  - `published`
  - `partial_failure`
  - `failed`

Validación local ejecutada en esta implementación:
- `pnpm --filter @betting-engine/odds-engine typecheck`: OK
- `pnpm --filter @betting-engine/odds-engine test`: OK
- `pnpm --filter @betting-engine/odds-engine build`: OK

> Nota: este estado refleja la implementación real actual del repositorio. El resto de esta sección mantiene la descripción arquitectónica conceptual de la fase.

### Objetivo de Esta Fase

Esta fase implementa la HU-003 y añade la lógica de negocio central del odds-engine. Ahora el servicio no solo persiste eventos, sino que calcula las cuotas resultantes y las publica para que estén disponibles para el bet-service.

El cálculo de cuotas utiliza un modelo simplificado documentado como tal. En producción, se usaría un modelo actuarial sofisticado con datos históricos y estadísticas de equipos. Para efectos de demostración, el modelo implementado proporciona valores razonables que varían según el estado del partido.

### El Modelo de Cuotas

El odds-engine calcula cuotas usando probabilidades implícitas basadas en tres factores principales:

El factor base asume una ventaja del equipo local reflejada en probabilidades base de cuarenta y cinco por ciento para victoria local, treinta por ciento para victoria visitante, y veinticinco por ciento para empate. Esta distribución refleja estadísticas históricas de partidos de fútbol donde el equipo local gana aproximadamente el cuarenta y cinco por ciento de las veces.

El factor de marcador ajusta las probabilidades según la diferencia de goles y el minuto actual del partido. Un equipo ganando por dos goles en el minuto ochenta tiene probabilidades mucho más altas de ganar que al inicio del partido, porque el tiempo remaining es limitado para una remontada.

El factor de tiempo pondera el impacto del marcador según qué tan avanzado está el partido. Un gol de ventaja en el minuto diez es menos significativo que un gol de ventaja en el minuto ochenta, porque el equipo local tiene más tiempo para reaccionar en el primer caso.

El modelo aplica un margen del cinco por ciento, conocido como vig, que representa la comisión de la casa de apuestas. Este margen asegura rentabilidad incluso si las probabilidades están perfectamente calibradas.

### Publicación de Cuotas con NestJS

Tras calcular las nuevas cuotas, el odds-engine realiza dos publicaciones:

La primera publicación escribe las cuotas en Redis con la clave `odds:{matchId}` y un TTL de trescientos segundos. Esta escritura permite que el bet-service consulte cuotas con latencia mínima mediante una simple lectura de Redis, sin necesidad de llamadas síncronas al odds-engine.

La segunda publicación envía un evento `OddsUpdatedEvent` al topic `odds.updated` de Kafka. Este evento incluye el matchId, las cuotas actualizadas y el identificador del evento que causó el recálculo. El bet-service consume estos eventos para invalidar o actualizar su própria caché de cuotas.

```typescript
// apps/odds-engine/src/infrastructure/adapters/kafka-odds.publisher.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { OddsPublisherPort } from '../../domain/ports/odds-publisher.port';

@Injectable()
export class KafkaOddsPublisher implements OddsPublisherPort {
  private readonly logger = new Logger(KafkaOddsPublisher.name);
  
  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}
  
  async publishToKafka(event: OddsUpdatedEvent): Promise<void> {
    this.logger.log(`Publishing odds update for match ${event.matchId}`);
    
    // emit() es asíncrono y maneja reintentos automáticamente
    this.kafkaClient.emit('odds.updated', {
      key: event.matchId,  // Clave para particionamiento
      value: event,
    });
  }
  
  async publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void> {
    // Implementado en RedisOddsPublisher...
  }
}

---

## Fase 4: Simulador CLI — HU-008 (Estado)

Se añadió un componente `simulator/` al monorepo como herramienta standalone para generar eventos de partido y publicarlos al topic `match.events`. El simulador es un CLI TypeScript que incorpora:

- Comandos `list-scenarios` y `simulate`.
- Modo `--fresh-match-ids` para regenerar `matchId` en memoria por corrida.
- Validación de archivos de escenario en JSON.
- Mapper a `MatchEvent` usando el contrato en `packages/shared-kernel`.
- Publicador Kafka basado en `kafkajs`.
- Scenarios estáticos iniciales: `normal-match`, `high-volatility`.

Estado actual:

- Implementación MVP completa en `simulator/` con tests unitarios y checks de compilación (`typecheck`, `build`, `test`) pasando.
- Ejecución runtime de `simulate` requiere la infraestructura Kafka levantada; al ejecutar sin Docker Compose activo, falla con `ECONNREFUSED` hacia `localhost:9092`.
- Con `--fresh-match-ids`, cada corrida crea partidos nuevos sin editar JSON y evita colisiones por `matchId` estático entre corridas.

Recomendaciones:

- Levantar infraestructura (`pnpm docker:up`) antes de ejecutar `simulate`.
- En un futuro, integrar control de escenarios vía API Gateway y añadir autenticación HMAC para el endpoint de ingestión (no implementado en Fase 4).

```

### Actualización del Módulo

```typescript
// apps/odds-engine/src/odds-engine.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    TypeOrmModule.forRoot({...}),
    
    // Configuración del cliente Kafka para publicar
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:9092'] },
          producer: { allowAutoTopicCreation: false },
        },
      },
    ]),
  ],
  controllers: [
    MatchEventsConsumer,
    HealthController,
  ],
  providers: [
    // Casos de uso
    ProcessMatchEventUseCase,
    RecalculateOddsUseCase,  // Nuevo
    
    // Puertos → Adaptadores
    {
      provide: 'MatchRepositoryPort',
      useClass: PostgresMatchRepository,
    },
    {
      provide: 'OddsPublisherPort',
      useClass: KafkaOddsPublisher,  // Nuevo
    },
    
    // Servicios de dominio
    OddsCalculatorService,  // Nuevo
  ],
})
export class OddsEngineModule {}
```

### Conexión con las Fases Anteriores y Siguientes

Esta fase depende de la fase anterior de dos maneras fundamentales. Primero, los datos del partido necesarios para el cálculo provienen de la persistencia implementada en la fase anterior. Segundo, el mecanismo de consumo de eventos que desencadena el recálculo fue implementado en la misma fase.

La conexión con fases siguientes es directa: las cuotas publicadas en Redis son consumidas por el bet-service cuando un usuario consulta partidos en vivo. El bet-service nunca llama al odds-engine directamente; obtiene cuotas exclusivamente del Redis cache o del topic `odds.updated`.

La verificación de esta fase se realiza publicando un evento `GOAL` y luego consultando Redis con `redis-cli get "odds:{matchId}"`. El resultado debe mostrar las cuotas recalculadas reflejando el nuevo marcador.

---

## Fase 4: Simulador CLI — Generación de Eventos

### Objetivo de Esta Fase

Esta fase implementa la HU-008 y crea la herramienta que permite generar eventos de partido para demostración y pruebas. El simulador es un proceso standalone que implementa la interfaz `IMatchDataProvider` y publica eventos directamente al topic `match.events` de Kafka.

El simulador no es un microservicio NestJS de la aplicación; es una herramienta de desarrollo y demostración. Su única responsabilidad es generar eventos realistas que permitan probar todo el sistema sin necesidad de una conexión a un proveedor de datos deportivo real.

### Arquitectura del Simulador

```
┌─────────────────────────────────────────────────────────────┐
│                     Simulador CLI                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Interface                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Commands:                                                ││
│  │ - --scenario <name>  (normal-match, high-volatility)   ││
│  │ - --speed <factor>   (1x, 30x, 60x)                    ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Scenario Runner                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Responsibilities:                                       ││
│  │ - Lee el escenario JSON                                 ││
│  │ - Aplica factor de velocidad                            ││
│  │ - Calcula delays entre eventos                          ││
│  │ - Transforma eventos del escenario a MatchEvents        ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Adapters                                                   │
│  ┌──────────────────────┐  ┌───────────────────────────────┐│
│  │ ScenarioEventMapper  │  │ KafkaProducerService         ││
│  │ - Parse scenario JSON │  │ - Publish to match.events    ││
│  │ - Generate UUIDs     │  │ - Handle connection errors    ││
│  │ - Set timestamps     │  │                               ││
│  └──────────────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Escenarios de Prueba

El simulador incluye dos escenarios predefinidos que demuestran diferentes situaciones de partido:

El escenario `normal-match` simula un partido estándar donde el equipo local gana uno a cero con un gol en el minuto veintitrés. Este escenario es predecible y útil para verificar que el sistema funciona correctamente bajo condiciones normales.

El escenario `high-volatility` simula una remontada espectacular donde el equipo visitante marca dos goles en la primera mitad, el equipo local recibe una tarjeta roja, y luego anota tres goles para ganar tres a dos. Este escenario demuestra cómo las cuotas cambian dramáticamente con eventos significativos.

### Factor de Velocidad

El factor de velocidad permite comprimir el tiempo del partido para demos rápidas. Un factor de sesenta veces significa que cada minuto de tiempo de partido ocurre en un segundo de tiempo real. Un partido completo de noventa minutos se completa en noventa segundos con factor sesenta.

El factor de velocidad se aplica al campo `delayFromPreviousMs` de cada evento en el escenario. El delay efectivo es `delayFromPreviousMs / speedFactor`. Para pruebas de carga donde se necesita observar el comportamiento bajo alta frecuencia de eventos, el factor uno mantiene los delays originales.

### Modos de Ejecución del Simulador

El CLI soporta dos modos operativos:

- Modo normal (default): usa el `matchId` definido en el escenario.
- Modo fresh (`--fresh-match-ids`): regenera un UUID por escenario en memoria para cada corrida.

Este segundo modo permite repetir un mismo escenario múltiples veces sin editar archivos `.json` y sin mezclar ejecuciones en el mismo partido lógico.

### Conexión con el Resto del Sistema

El simulador es completamente independiente del resto de los servicios NestJS. No consume ningún topic, no accede a ninguna base de datos. Su única interacción es publicar al topic `match.events` de Kafka.

Esta independencia es intencional y refleja el patrón de arquitectura hexagonal. El odds-engine no sabe que los eventos provienen de un simulador; consume eventos de Kafka sin importar su origen. Un proveedor de datos real como SportRadar podría reemplazar el simulador cambiando solo la configuración de la variable de entorno `MATCH_DATA_PROVIDER`.

La verificación de esta fase consiste en ejecutar `pnpm --filter @betting-engine/simulator simulate -- --scenario high-volatility --speed 60x` y observar que los eventos aparecen en los logs del odds-engine y que las cuotas en Redis se actualizan correspondientemente.

Para corridas repetidas sobre el mismo escenario, se recomienda:

`pnpm --filter @betting-engine/simulator simulate -- --scenario high-volatility --speed 60x --fresh-match-ids`

### Extension Recomendada (Portfolio): Ingesta de Proveedor Real

Como evolucion natural del simulador, se recomienda una fase adicional de ingesta
de proveedor real manteniendo el contrato interno por Kafka:

```
Proveedor externo -> Webhook/API Gateway -> match.events -> odds-engine + settlement
```

El objetivo de esta extension no es cambiar la logica de negocio de consumidores,
sino agregar una capa de entrada segura y estandarizada que:
- valide autenticidad del proveedor (API key o firma HMAC),
- transforme payload externo a `MatchEvent` del `shared-kernel`,
- publique en `match.events` y responda `202 Accepted`.

Con este enfoque, `odds-engine` y `settlement` permanecen desacoplados del origen
de datos y reutilizan exactamente el mismo flujo ya implementado.

---

## Fase 5: API Gateway — Punto Único de Entrada

### Estado de Implementación (2026-04-22)

HU-005 se encuentra implementada en `api-gateway` con una versión operativa del flujo completo:

- `ProxyRequestUseCase` orquesta autenticación JWT, rate limiting y forward HTTP.
- `JwtAuthAdapter` valida tokens JWT para usuarios.
- `HttpServiceRouterAdapter` forward requests a servicios backend usando `@nestjs/axios`.
- `RedisRateLimiterAdapter` implementa rate limiting con Redis.
- `GatewayController` provee catch-all route para proxificar a servicios.
- `OddsStreamGateway` provee WebSocket namespace `stream/odds`.
- Configuración de rutas en `services.config.ts` con auth y rate limits por endpoint.

Validación local ejecutada en esta implementación:
- `pnpm --filter @betting-engine/api-gateway typecheck`: OK
- `pnpm --filter @betting-engine/api-gateway build`: OK

> Nota: este estado refleja la implementación real actual del repositorio. El resto de esta sección mantiene la descripción arquitectónica conceptual de la fase.

### Objetivo de Esta Fase

Esta fase implementa la infraestructura de la API Gateway con NestJS, el componente crítico que evita la comunicación directa entre clientes y microservicios. La API Gateway actúa como fachada única, proporcionando autenticación, rate limiting, enrutamiento y agregación de respuestas.

La implementación de la API Gateway antes de exponer endpoints públicos garantiza que **desde el primer día, los clientes nunca se comuniquen directamente con los microservicios**. Este principio de seguridad es no negociable.

### Arquitectura de la API Gateway con NestJS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway (NestJS)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Domain Layer                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Route Entity                                                        ││
│  │ - pathPattern, targetService, methods, requiresAuth                 ││
│  │                                                                     ││
│  │ ServiceRouterPort (interface)                                       ││
│  │ - forwardRequest(), getServiceHealth()                              ││
│  │                                                                     ││
│  │ AuthProviderPort (interface)                                        ││
│  │ - validateToken()                                                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Application Layer                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ProxyRequestUseCase (@Injectable)                                   ││
│  │ 1. Validar autenticación (si requerida)                            ││
│  │ 2. Aplicar rate limiting                                            ││
│  │ 3. Resolver ruta → servicio destino                                 ││
│  │ 4. Forward request al servicio                                      ││
│  │ 5. Retornar respuesta al cliente                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Infrastructure Layer                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ JwtAuthAdapter (@Injectable)                                        ││
│  │ implements AuthProviderPort usando @nestjs/jwt                      ││
│  │                                                                     ││
│  │ HttpServiceRouterAdapter (@Injectable)                              ││
│  │ implements ServiceRouterPort usando @nestjs/axios                   ││
│  │                                                                     ││
│  │ RateLimiterAdapter (@Injectable)                                    ││
│  │ implementa rate limiting con Redis                                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Interface Layer                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ GatewayController (@Controller)                                     ││
│  │ @All(':service/*') → ProxyRequestUseCase                           ││
│  │                                                                     ││
│  │ Middleware Stack                                                    ││
│  │ - AuthMiddleware (valida JWT)                                      ││
│  │ - RateLimitMiddleware (protección de recursos)                     ││
│  │ - RequestLoggerMiddleware (logging estructurado)                   ││
│  │                                                                     ││
│  │ OddsStreamGateway (@WebSocketGateway)                               ││
│  │ - namespace: 'stream/odds'                                         ││
│  │ - @SubscribeMessage('subscribe')                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  api-gateway.module.ts                                                  │
│  ├── @Module({ imports: [HttpModule, JwtModule], ... })                │
│  └── implements NestModule { configure(consumer: MiddlewareConsumer) } │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Módulo Principal de la API Gateway

```typescript
// apps/api-gateway/src/api-gateway.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    HttpModule,           // Para forward requests HTTP (@nestjs/axios)
    JwtModule.register({  // Para validación de tokens (@nestjs/jwt)
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    GatewayController,
    HealthController,
  ],
  providers: [
    // Casos de uso
    ProxyRequestUseCase,
    AggregateResponseUseCase,
    
    // Puertos → Adaptadores (Inyección de Dependencias)
    {
      provide: AUTH_PROVIDER_PORT,
      useClass: JwtAuthAdapter,
    },
    {
      provide: SERVICE_ROUTER_PORT,
      useClass: HttpServiceRouterAdapter,
    },
    },
    {
      provide: 'RateLimiterPort',
      useClass: RedisRateLimiterAdapter,
    },
    
    // Servicios de dominio
    RouteResolverService,
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Middleware global para todas las rutas
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('*');
    
    // Rate limiting para todas las rutas
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('*');
    
    // Autenticación solo para rutas protegidas
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'bets', method: RequestMethod.ALL },
        { path: 'bets/*', method: RequestMethod.ALL },
        { path: 'user/*', method: RequestMethod.ALL },
      );
  }
}
```

### Controlador Gateway

```typescript
// apps/api-gateway/src/interface/http/gateway.controller.ts
import { All, Req, Res, Param, Headers, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyRequestUseCase } from '../../application/use-cases/proxy-request.use-case';

@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);
  
  constructor(
    private readonly proxyRequestUseCase: ProxyRequestUseCase,
  ) {}
  
  // Catch-all route: /{service}/**
  @All(':service/*')
  async proxyRequest(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`Proxying ${req.method} ${req.path} to ${service}`);
    
    const response = await this.proxyRequestUseCase.execute({
      service,
      path: req.path,
      method: req.method,
      headers: req.headers,
      body: req.body,
      authToken: authHeader,
    });
    
    res.status(response.statusCode).json(response.body);
  }
}
```

### Middleware de Autenticación

```typescript
// apps/api-gateway/src/interface/http/middleware/auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthAdapter } from '../../infrastructure/adapters/jwt-auth.adapter';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject('AuthProviderPort')
    private readonly authProvider: AuthProviderPort,
  ) {}
  
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    
    const payload = await this.authProvider.validateToken(token);
    
    if (!payload) {
      throw new UnauthorizedException('Token inválido');
    }
    
    // Adjuntar usuario al request para uso posterior
    req['user'] = payload;
    next();
  }
}
```

### WebSocket Gateway para Streaming

```typescript
// apps/api-gateway/src/interface/websocket/odds-stream.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'stream/odds',
  cors: { origin: '*' },
})
export class OddsStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  // Mapa de suscripciones: matchId -> Set<socketId>
  private subscriptions = new Map<string, Set<string>>();
  
  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
  }
  
  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
    // Limpiar suscripciones...
  }
  
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, matchId: string): void {
    client.join(`match:${matchId}`);
    
    if (!this.subscriptions.has(matchId)) {
      this.subscriptions.set(matchId, new Set());
    }
    this.subscriptions.get(matchId).add(client.id);
    
    console.log(`Client ${client.id} subscribed to match ${matchId}`);
  }
  
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, matchId: string): void {
    client.leave(`match:${matchId}`);
    this.subscriptions.get(matchId)?.delete(client.id);
  }
  
  // Método llamado cuando llega evento de Kafka desde el backend
  broadcastOddsUpdate(matchId: string, odds: OddsSnapshot): void {
    this.server.to(`match:${matchId}`).emit('odds.updated', {
      matchId,
      odds,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Configuración de Rutas

La API Gateway mantiene una configuración de rutas que define qué endpoints de cada servicio están expuestos públicamente:

```typescript
// apps/api-gateway/src/infrastructure/config/services.config.ts
export const routeConfig = [
  // Bet Service - Público
  { path: '/matches/**', service: 'bet-service', methods: ['GET'], auth: false },
  { path: '/bets', service: 'bet-service', methods: ['GET', 'POST'], auth: true },
  { path: '/bets/**', service: 'bet-service', methods: ['GET'], auth: true },
  
  // Odds Engine - Solo interno (no expuesto)
  // Settlement - No expuesto (sin endpoints HTTP públicos)
  
  // Health - Solo orquestador
  { path: '/health', service: '*', methods: ['GET'], auth: false },
];
```

### Rate Limiting

El rate limiting protege los servicios backend de sobrecarga:

```typescript
// apps/api-gateway/src/infrastructure/adapters/rate-limiter.adapter.ts
@Injectable()
export class RedisRateLimiterAdapter implements RateLimiterPort {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}
  
  async isAllowed(key: string, config: RateLimitConfig): Promise<boolean> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.pexpire(key, config.windowMs);
    }
    
    return current <= config.maxRequests;
  }
}

// Configuración por endpoint
const rateLimits = {
  '/matches/live': { windowMs: 60000, maxRequests: 100 },  // 100 req/min
  '/bets': { windowMs: 60000, maxRequests: 10 },           // 10 req/min
  default: { windowMs: 60000, maxRequests: 60 },           // 60 req/min
};
```

### Verificación de la Fase

Para verificar que la API Gateway funciona correctamente:

```bash
# 1. Verificar que endpoints internos NO son accesibles directamente
curl http://localhost:3001/internal/matches      # Debe fallar (odds-engine)
curl http://localhost:3002/internal/bets         # Debe fallar (bet-service)

# 2. Verificar que endpoints públicos funcionan vía Gateway
curl http://localhost:3000/matches/live          # Gateway → Bet Service
curl http://localhost:3000/health                # Gateway health

# 3. Verificar autenticación
curl http://localhost:3000/bets                  # Debe retornar 401 (sin token)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/bets                  # Debe retornar 200

# 4. Verificar rate limiting
for i in {1..15}; do
  curl http://localhost:3000/matches/live
done
# Las últimas peticiones deben retornar 429 (Too Many Requests)
```

### Conexión con las Fases Anteriores y Siguientes

Esta fase no depende de funcionalidades de los microservicios, pero debe implementarse antes de exponer cualquier endpoint público. La API Gateway se conecta a los servicios backend mediante HTTP interno (red de Docker).

Las fases siguientes (Bet Service endpoints públicos) asumen que la API Gateway ya está funcionando y configurada para enrutar peticiones correctamente.

---

## Fase 6: Bet Service — Consulta de Partidos en Vivo

### Objetivo de Esta Fase

Esta fase implementa la HU-004 y crea el primer endpoint público del bet-service. El endpoint `GET /matches/live` permite a los clientes consultar los partidos disponibles con sus cuotas actuales, accesible exclusivamente a través de la API Gateway.

Esta es la primera fase donde un servicio consume datos publicados por otro. El bet-service obtiene cuotas del Redis cache donde el odds-engine las publica. Esta separación ilustra el principio de que los servicios no se comunican mediante llamadas síncronas, sino mediante datos compartidos en un almacén común.

### Arquitectura del Bet Service para Consulta de Partidos

```
┌─────────────────────────────────────────────────────────────┐
│                      Bet Service (NestJS)                   │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GetLiveMatchesUseCase (@Injectable)                     ││
│  │ - Solicita matchIds activos al odds-engine (futuro)     ││
│  │ - Consulta cuotas en Redis para cada matchId           ││
│  │ - Filtra partidos sin cuotas válidas                    ││
│  │ - Retorna lista formateada                              ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RedisOddsReader (@Injectable)                          ││
│  │ implements OddsReaderPort usando ioredis               ││
│  │ - getOdds(matchId): Promise<OddsSnapshot | null>       ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Interface Layer                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ MatchController (@Controller, public/)                  ││
│  │ @Get('matches/live')                                    ││
│  │ - Invoca GetLiveMatchesUseCase                          ││
│  │ - Maneja errores y formatea respuesta                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Módulo del Bet Service

```typescript
// apps/bet-service/src/bet-service.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      // ...
    }),
    TypeOrmModule.forFeature([BetEntity, UserEntity]),
    
    // Configuración del cliente Kafka para publicar eventos
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:9092'] },
          producer: { allowAutoTopicCreation: false },
        },
      },
    ]),
  ],
  controllers: [
    // HTTP
    BetController,
    MatchController,
    InternalBetsController,
    HealthController,
    
    // Kafka Consumer
    OddsUpdatedConsumer,
  ],
  providers: [
    // Casos de uso
    PlaceBetUseCase,
    GetLiveMatchesUseCase,
    
    // Puertos → Adaptadores
    {
      provide: 'BetRepositoryPort',
      useClass: PostgresBetRepository,
    },
    {
      provide: 'OddsReaderPort',
      useClass: RedisOddsReader,
    },
    
    // Servicios de dominio
    BetValidatorService,
  ],
})
export class BetServiceModule {}
```

### Consumer de Kafka

```typescript
// apps/bet-service/src/interface/kafka/odds-updated.consumer.ts
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OddsUpdatedEvent } from '@betting-engine/shared-kernel';

@Controller()
export class OddsUpdatedConsumer {
  private readonly logger = new Logger(OddsUpdatedConsumer.name);
  
  @EventPattern('odds.updated')
  async handleOddsUpdated(@Payload() event: OddsUpdatedEvent): Promise<void> {
    this.logger.log(
      `Received odds update for match ${event.matchId}: ` +
      `Home=${event.odds.home}, Draw=${event.odds.draw}, Away=${event.odds.away}`,
    );
    
    // Actualizar caché local si es necesario
    // O simplemente confiar en Redis
  }
}
```

### Flujo de Consulta de Partidos

Cuando un cliente hace una petición a `GET /matches/live` vía API Gateway, el flujo es el siguiente:

El API Gateway recibe la petición, aplica rate limiting y autenticación (si es requerida), y forward al bet-service. El controlador del bet-service recibe la petición y la delega al use case.

El use case necesita primero conocer qué partidos están activos. En una implementación completa, consultaría al odds-engine por la lista de partidos con estado `LIVE`, pero por simplicidad, el use case asume que conoce los matchIds activos o los obtiene de un índice en Redis.

Para cada matchId activo, el use case consulta el puerto `OddsReaderPort` para obtener las cuotas actuales desde Redis. Si Redis retorna `null` (cache miss o TTL expirado), el partido se excluye del resultado con un log de warning.

El use case formatea la respuesta incluyendo el identificador del partido, nombres de equipos, cuotas actuales y estado. El controlador retorna la respuesta con código HTTP doscientos y el array de partidos.

### Nota de Implementación: Estado de Partido desde PostgreSQL

La documentación conceptual menciona consultar al odds-engine por la lista de partidos activos. La implementación real tomó una decisión diferente por razones de desacoplamiento y simplicidad:

En lugar de hacer una llamada HTTP síncrona al odds-engine, bet-service consulta directamente la tabla `odds_engine.matches` en PostgreSQL. Esta decisión:
- Mantiene el desacoplamiento entre servicios (no hay dependencia de respuesta síncrona)
- Usa datos que odds-engine ya persiste en PostgreSQL
- Permite obtener el estado completo del partido (score, minuto) junto con las cuotas de Redis

Esta aproximación es técnicamente equivalente en resultado, pero más robusta operacionalmente.

### Manejo de Cache Miss

Un cache miss puede ocurrir por varias razones: el TTL de trescientos segundos expiró, el partido aún no ha publicado cuotas iniciales, o Redis tuvo un fallo temporal. En todos los casos, el comportamiento es el mismo: el partido no aparece en la lista de partidos en vivo.

Este comportamiento es intencional. Un usuario no debe poder apostar en un partido cuyas cuotas no están disponibles. La exclusión silenciosa con logging permite que el sistema continúe operando si algunos partidos tienen problemas de datos, sin afectar la experiencia del usuario para partidos con datos válidos.

### Conexión con las Fases Anteriores y Siguientes

Esta fase depende directamente de la fase tres del odds-engine. Sin las cuotas publicadas a Redis, el endpoint retornaría siempre un array vacío. La verificación de esta fase requiere que el simulador haya corrido al menos una vez para generar eventos y que el odds-engine haya procesado esos eventos hasta publicar cuotas.

La conexión con la siguiente fase es igualmente directa: cuando un usuario selecciona un partido del catálogo y decide apostar, el endpoint `POST /bets` utilizará las mismas cuotas de Redis para validar la apuesta.

La verificación de esta fase se realiza iniciando el simulador, esperando a que se publiquen las cuotas iniciales, y luego consultando `GET /matches/live` vía API Gateway. La respuesta debe incluir el partido del simulador con cuotas válidas.

```bash
# Verificación completa
curl http://localhost:3000/matches/live
# Debe retornar array con partidos y cuotas
```

---

## Fase 7: Bet Service — Registro de Apuestas

### Objetivo de Esta Fase

Esta fase implementa la HU-005 y HU-005b, añadiendo la funcionalidad core del bet-service: permitir que usuarios registren apuestas y validarlas según reglas de negocio específicas.

El registro de apuestas es la operación más compleja del bet-service porque involucra múltiples validaciones, modificaciones de estado (saldo del usuario) y coordinación con otros servicios mediante publicación de eventos.

### Flujo Completo de Registro de Apuesta

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    POST /bets - Flujo Completo                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. API Gateway (NestJS)                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │ - @Middleware AuthMiddleware (valida JWT)                       │  │
│     │ - @Middleware RateLimitMiddleware (10 req/min para /bets)       │  │
│     │ - @Controller Gateway (forward a bet-service)                   │  │
│     └─────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  2. Validación de Entrada                                                │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │ BetValidatorService (@Injectable)                                  │  │
│     │ - Verificar que matchId existe en Redis (partido en vivo)       │  │
│     │ - Verificar que |requestedOdds - currentOdds| <= 0.01             │  │
│     │ - Verificar que stake <= $1,000 (límite por apuesta)              │  │
│     │ - Verificar que balance >= stake                                  │  │
│     │ - Verificar que acumulado pendiente del usuario <= $5,000         │  │
│     └─────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  3. Transacción de Base de Datos                                         │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │ BEGIN TRANSACTION (TypeORM)                                       │  │
│     │   - Debitar stake del balance del usuario                        │  │
│     │   - Crear fila en bets con status='PENDING'                      │  │
│     │   - Calcular potential_payout_cents                              │  │
│     │ COMMIT                                                            │  │
│     └─────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  4. Publicación de Evento (post-commit)                                  │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │ @Inject('KAFKA_CLIENT')                                          │  │
│     │ client.emit('bet.placed', { key: userId, value: event })         │  │
│     │ Publish to Kafka topic: bet.placed                               │  │
│     │ { betId, userId, matchId, selection, acceptedOdds, stakeCents }   │  │
│     └─────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  5. Respuesta al Cliente                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │ HTTP 201 Created                                                  │  │
│     │ { betId, status: 'PENDING', potentialPayoutCents }              │  │
│     └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Publicación de Eventos con NestJS

```typescript
// apps/bet-service/src/application/use-cases/place-bet.use-case.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class PlaceBetUseCase {
  private readonly logger = new Logger(PlaceBetUseCase.name);
  
  constructor(
    @Inject('BetRepositoryPort')
    private readonly betRepository: BetRepositoryPort,
    @Inject('OddsReaderPort')
    private readonly oddsReader: OddsReaderPort,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
    private readonly betValidator: BetValidatorService,
  ) {}
  
  async execute(dto: PlaceBetDto): Promise<Bet> {
    // 1. Validar reglas de negocio
    await this.validateBet(dto);
    
    // 2. Crear apuesta en transacción
    const bet = await this.betRepository.create(dto);
    
    // 3. Publicar evento POST-COMMIT
    await this.publishBetPlacedEvent(bet);
    
    return bet;
  }
  
  private async publishBetPlacedEvent(bet: Bet): Promise<void> {
    const event: BetPlacedEvent = {
      betId: bet.id,
      userId: bet.userId,
      matchId: bet.matchId,
      selection: bet.selection,
      acceptedOdds: bet.acceptedOdds,
      stakeCents: bet.stakeCents,
      timestamp: new Date().toISOString(),
    };
    
    this.logger.log(`Publishing bet.placed event for bet ${bet.id}`);
    
    // Publicar a Kafka con particionamiento por usuario
    this.kafkaClient.emit('bet.placed', {
      key: bet.userId,
      value: event,
    });
  }
}
```

### Validación de Cuotas

La validación de cuotas es crítica para prevenir arbitragem. Un usuario no debe poder apostar a una cuota que ya no está disponible. El flujo es el siguiente:

El cliente envía la apuesta incluyendo la cuota que vió en su pantalla. El bet-service consulta Redis para obtener la cuota actual del partido. Si la diferencia entre la cuota enviada y la actual es mayor que cero punto cero uno, la apuesta se rechaza con HTTP cuatrocientos nueve.

Este margen de tolerancia del uno por ciento maneja la situación donde las cuotas cambian entre el momento en que el usuario ve la pantalla y el momento en que envía la petición. En producción, este margen podría ser menor o inexistente dependiendo de los requisitos de negocio.

### Validación de Saldo y Límites

El sistema implementa tres tipos de límites para gestionar el riesgo:

El límite por apuesta individual de mil dólares previene que un usuario haga una apuesta única excesivamente grande. Este límite se aplica al campo `stakeCents` de la petición.

El límite de saldo previene apuestas que exceden el balance disponible del usuario. El sistema verifica que `balanceCents >= stakeCents` antes de procesar.

El límite acumulado por partido de cinco mil dólares previene que un usuario distribuya múltiples apuestas pequeñas para evadir el límite individual. El sistema suma todas las apuestas pendientes del usuario para ese partido y verifica que el total más la nueva apuesta no exceda el límite.

### Transaccionalidad

La operación de debitar saldo y crear la apuesta debe ser atómica. Si la creación de la apuesta falla, el saldo no debe haberse debitado. Esta atomicidad se garantiza mediante una transacción de base de datos.

El uso de transacciones también previene condiciones de carrera donde dos apuestas simultáneas del mismo usuario podrían ambas pasar la verificación de saldo aunque individualmente no tuvieran suficiente. El isolation level de la transacción asegura que solo una operación vea el saldo real en el momento de la verificación.

### Publicación Asíncrona del Evento

La publicación del evento `BetPlacedEvent` ocurre después del commit de la transacción. Esta decisión de diseño es crítica: si la publicación falla, la apuesta ya está registrada y el usuario recibió confirmación exitosa. El Settlement recibirá el evento en su siguiente lectura del topic, procesando la apuesta con delay pero sin pérdida de datos.

Si la publicación estuviera antes del commit y fallara, tendríamos que decidir entre rollback de la transacción (invalidando la confirmación al usuario) o commit sin publicación (dejando la apuesta sin liquidar). Ambas opciones son peores que el enfoque adoptado.

### Endpoint Interno para Settlement

La HU-005b implementa los endpoints internos que Settlement necesita para procesar apuestas. Estos endpoints **NO** están expuestos en la API Gateway; son accesibles solo desde la red interna de Docker.

```typescript
// apps/bet-service/src/interface/http/internal/bets.controller.ts
@Controller('internal')
export class InternalBetsController {
  constructor(
    private readonly betRepository: BetRepositoryPort,
  ) {}
  
  @Get('bets')
  async getPendingBets(
    @Query('matchId') matchId: string,
    @Query('status') status: BetStatus,
  ): Promise<Bet[]> {
    return this.betRepository.findByMatchAndStatus(matchId, status);
  }
  
  @Patch('bets/:betId/settle')
  async settleBet(
    @Param('betId') betId: string,
    @Body() dto: SettleBetDto,
  ): Promise<void> {
    await this.betRepository.settleBet(betId, dto.result);
  }
}
```

El endpoint `GET /internal/bets?matchId={id}&status=PENDING` permite a Settlement obtener todas las apuestas pendientes de un partido específico para procesarlas. El endpoint `PATCH /internal/bets/{betId}/settle` permite actualizar el estado de una apuesta y acreditar ganancias si corresponde.

### Conexión con las Fases Siguientes

Esta fase no tiene dependencias de fases posteriores. Sin embargo, prepara el terreno para Settlement: los eventos publicados a `bet.placed` serán consumidos por Settlement, y los endpoints internos serán llamados por Settlement para obtener y actualizar apuestas.

La verificación de esta fase incluye crear apuestas válidas que deben retornar HTTP doscientos uno, intentar crear apuestas con cuotas desactualizadas que deben retornar HTTP cuatrocientos nueve, y verificar que los eventos aparecen en el topic `bet.placed`.

```bash
# Crear apuesta válida (vía API Gateway)
curl -X POST http://localhost:3000/bets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "sim-demo-001",
    "selection": "HOME",
    "stakeCents": 1000,
    "requestedOdds": 1.85
  }'
# Debe retornar 201 Created

# Intentar con cuota desactualizada
curl -X POST http://localhost:3000/bets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "sim-demo-001",
    "selection": "HOME",
    "stakeCents": 1000,
    "requestedOdds": 5.00  # Cuota muy diferente
  }'
# Debe retornar 409 Conflict
```

---

## Fase 8: Settlement — Liquidación de Apuestas

### Objetivo de Esta Fase

Esta fase implementa la HU-006 y HU-007, completando el flujo de negocio del sistema de apuestas. Settlement es responsable de procesar las apuestas cuando un partido termina, determinando cuáles ganó el usuario y acreditando las ganancias correspondientes.

El Settlement consume eventos de dos topics diferentes: `match.events` para detectar cuándo termina un partido, y `bet.placed` para registrar apuestas que podrían necesitar liquidación cuando llegue el evento de fin de partido.

### Arquitectura del Settlement con NestJS

```
┌─────────────────────────────────────────────────────────────┐
│                      Settlement Service (NestJS)            │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer                                               │
│  ┌────────────────────────────────────────────────────────┐│
│  │ SettlementCalculator (@Injectable)                      ││
│  │ evaluate(selection, result): boolean                    ││
│  │ - HOME vs HOME_WIN → true                              ││
│  │ - DRAW vs DRAW → true                                  ││
│  │ - AWAY vs AWAY_WIN → true                             ││
│  │ - cualquier otra combinación → false                   ││
│  └────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ┌────────────────────────────────────────────────────────┐│
│  │ SettleMatchUseCase (@Injectable)                       ││
│  │ 1. Verificar idempotencia (matchId en processed_matches)││
│  │ 2. Obtener apuestas pendientes del partido             ││
│  │ 3. Para cada apuesta: evaluar y liquidar                ││
│  │ 4. Registrar partido como procesado                    ││
│  │ 5. Publicar eventos BetSettledEvent                    ││
│  └────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Interface Layer                                            │
│  ┌──────────────────────┐  ┌───────────────────────────────┐│
│  │ MatchEndConsumer    │  │ BetPlacedConsumer             ││
│  │ @Controller         │  │ @Controller                   ││
│  │ @EventPattern       │  │ @EventPattern                 ││
│  │ ('match.events')    │  │ ('bet.placed')                ││
│  └──────────────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Configuración del Microservicio Settlement

```typescript
// apps/settlement/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { SettlementModule } from './settlement.module';

async function bootstrap() {
  const app = await NestFactory.create(SettlementModule);
  
  // Settlement consume múltiples topics
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { brokers: ['kafka:9092'] },
      consumer: {
        groupId: 'settlement-consumer',
      },
      subscribe: {
        fromBeginning: true,  // Procesar mensajes históricos al reiniciar
      },
    },
  });
  
  await app.startAllMicroservices();
  await app.listen(3003);
}

bootstrap();
```

### Consumer de Match End

```typescript
// apps/settlement/src/interface/kafka/match-end.consumer.ts
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { SettleMatchUseCase } from '../../application/use-cases/settle-match.use-case';
import { MatchEvent, MatchEventType } from '@betting-engine/shared-kernel';

@Controller()
export class MatchEndConsumer {
  private readonly logger = new Logger(MatchEndConsumer.name);
  
  constructor(
    private readonly settleMatchUseCase: SettleMatchUseCase,
  ) {}
  
  @EventPattern('match.events')
  async handleMatchEvent(
    @Payload() event: MatchEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    // Solo procesar eventos de fin de partido
    if (event.type !== MatchEventType.MATCH_END) {
      return;
    }
    
    this.logger.log(`Processing MATCH_END for match ${event.matchId}`);
    
    try {
      await this.settleMatchUseCase.execute({
        matchId: event.matchId,
        result: event.payload.result,
      });
      
      // Commit manual
      const { offset, partition, topic } = context.getMessage();
      await context.getConsumer().commitOffsets([
        { topic, partition, offset: (BigInt(offset) + BigInt(1)).toString() },
      ]);
    } catch (error) {
      this.logger.error(`Settlement failed for match ${event.matchId}:`, error);
      throw error;  // Kafka reintentará
    }
  }
}
```

### Flujo de Liquidación

Cuando Settlement recibe un evento `MATCH_END`, el flujo es el siguiente:

Primero, verifica idempotencia consultando la tabla `processed_matches` por el matchId. Si el partido ya fue procesado, registra un warning y retorna sin hacer nada.

Segundo, obtiene todas las apuestas pendientes del partido llamando a `GET /internal/bets?matchId={id}&status=PENDING` del bet-service. Esta llamada retorna la lista completa de apuestas que necesitan liquidación.

Tercero, para cada apuesta pendiente, el SettlementCalculator evalúa si la selección del usuario coincide con el resultado del partido. Si el usuario seleccionó `HOME` y el resultado es `HOME_WIN`, la apuesta gana. De lo contrario, pierde.

Cuarto, para cada apuesta, Settlement llama a `PATCH /internal/bets/{betId}/settle` con el resultado. El bet-service actualiza el estado de la apuesta y, si ganó, acredita el `potentialPayoutCents` al balance del usuario.

Quinto, Settlement registra el partido como procesado en `processed_matches`, garantizando que no se procesará nuevamente aunque llegue otro evento `MATCH_END` por duplicado.

Sexto, Settlement publica un `BetSettledEvent` por cada apuesta al topic `bet.settled`, permitiendo que servicios futuros de notificaciones procesen los resultados.

### Evaluación de Apuestas

La evaluación compara la selección del usuario con el resultado precalculado del partido. Un partido puede terminar con tres resultados posibles: `HOME_WIN`, `DRAW`, o `AWAY_WIN`. El usuario selecciona entre tres opciones: `HOME`, `DRAW`, o `AWAY`.

La correspondencia es directa: `HOME` gana si y solo si el resultado es `HOME_WIN`. Esta lógica se implementa como una comparación simple en el SettlementCalculator, y está cubierta por tests unitarios exhaustivos.

### Idempotencia en Settlement

La idempotencia en Settlement es más crítica que en otros servicios porque un error de doble procesamiento tendría impacto financiero directo. Un usuario no debe recibir sus ganancias dos veces, ni su apuesta debe marcarse como liquidada múltiples veces.

El mecanismo de idempotencia utiliza la tabla `processed_matches` con `match_id` como primary key. Cuando Settlement intenta procesar un partido ya procesado, la base de datos rechaza el INSERT con un error de clave duplicada. El código captura este error y retorna gracefully.

Este mecanismo protege contra dos escenarios de duplicación: mensajes duplicados de Kafka delivery y reinicios del servicio Settlement durante el procesamiento.

### Resiliencia ante Caídas

La HU-007 implementa mecanismos de resiliencia para garantizar que Settlement procesa todas las apuestas incluso ante fallos. El consumer de Kafka está configurado con retry automático:

Cuando el `SettleMatchUseCase` lanza una excepción, Kafka reintenta automáticamente hasta tres veces con backoff exponencial. Si todos los intentos fallan, el mensaje se publica al Dead Letter Queue `bet.placed.dlq` y el offset se marca como procesado, previniendo que el consumer se quede bloqueado en un mensaje problemático.

```typescript
// apps/settlement/src/interface/kafka/dlq.producer.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class DlqProducer {
  private readonly logger = new Logger(DlqProducer.name);
  
  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}
  
  async sendToDlq(
    originalMessage: any,
    error: Error,
    retryCount: number,
  ): Promise<void> {
    const dlqMessage = {
      originalMessage,
      error: {
        message: error.message,
        stack: error.stack,
      },
      retryCount,
      timestamp: new Date().toISOString(),
    };
    
    this.logger.warn(`Sending message to DLQ after ${retryCount} retries`);
    
    this.kafkaClient.emit('bet.placed.dlq', dlqMessage);
  }
}
```

### Conexión con las Fases Anteriores

Esta fase depende de todas las anteriores para funcionar correctamente. Depende del simulador para generar eventos `MATCH_END`. Depende del odds-engine para mantener el estado del partido y garantizar que el resultado está disponible. Depende del bet-service para proporcionar los endpoints internos y para acreditar ganancias.

La verificación completa de esta fase requiere ejecutar el simulador, crear apuestas durante el partido, y observar que todas las apuestas se liquidan correctamente al terminar. Esta es la primera vez que el sistema completo opera end-to-end.

---

## Fase 9: Observabilidad — Healthchecks y Logs

### Objetivo de Esta Fase

Esta fase implementa la HU-009 y añade capacidades de observabilidad que permiten monitorear el estado del sistema y depurar problemas. Aunque es opcional, es altamente recomendada antes de presentar el proyecto.

La observabilidad en sistemas distribuidos es fundamental porque un problema en un servicio puede manifestarse como síntomas en otro. Sin logs estructurados y correlation IDs, trazar una transacción a través de múltiples servicios NestJS es extremadamente difícil.

### Healthchecks en NestJS

Cada servicio NestJS expone un endpoint `GET /health` que verifica el estado de sus dependencias:

```typescript
// apps/odds-engine/src/interface/http/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}
  
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      // Más checks...
    ]);
  }
}
```

El healthcheck de Kafka confirma que el consumer puede suscribirse a sus topics y que la conexión está activa. El healthcheck de PostgreSQL ejecuta una consulta simple como `SELECT 1` para confirmar que la base de datos responde. El healthcheck de Redis ejecuta el comando `PING` para confirmar que el servidor responde.

El endpoint retorna HTTP doscientos con un JSON indicando el estado de cada dependencia cuando todas están operativas. Si alguna dependencia falla, el campo correspondiente muestra el error y el HTTP status code es quinientos tres.

**Nota importante**: Los healthchecks de los microservicios son accesibles solo desde la red interna (para el orquestador de contenedores). El healthcheck de la API Gateway es el único expuesto públicamente.

### Logs Estructurados

Todos los logs siguen un formato estructurado en JSON que facilita el parsing y análisis:

```typescript
// Configuración de logger en main.ts
import { Logger } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const logger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});

const app = await NestFactory.create(AppModule, { logger });
```

```json
{
  "level": "info",
  "message": "Apuesta procesada exitosamente",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "service": "bet-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": {
    "betId": "bet-uuid",
    "userId": "user-001",
    "matchId": "match-uuid",
    "stakeCents": 5000
  }
}
```

El `correlationId` permite trazar todos los logs generados por una única operación a través de múltiples servicios. Cuando el odds-engine procesa un evento, genera un correlationId que se propaga a todos los logs relacionados.

### Trazabilidad de Transacciones

Cuando un evento fluye a través del sistema, el correlationId lo acompaña:

1. El simulador genera el evento con un correlationId único
2. El odds-engine incluye el correlationId en todos sus logs de procesamiento
3. El bet-service incluye el correlationId en logs de validación y registro
4. Settlement incluye el correlationId en logs de evaluación y liquidación

Este patrón permite responder preguntas como: "¿Qué pasó con la apuesta del usuario X?" buscando por correlationId en todos los logs de todos los servicios.

---

## Resumen de Dependencias Entre Fases

### Diagrama de Dependencias

```
┌─────────────────┐
│  Fase 0         │  shared-kernel
│  (contrato)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fase 1         │  docker-compose
│  (infraestructura)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Fase 2         │     │  Fase 4         │
│  odds-engine    │     │  simulador CLI  │
│  consume eventos │     │  genera eventos │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ match.events          │ match.events
         │                       │
         ▼                       │
┌─────────────────┐              │
│  Fase 3         │              │
│  odds-engine    │              │
│  calcula cuotas │              │
└────────┬────────┘              │
         │                       │
         │ odds.updated          │
         │ (Redis)               │
         │                       │
         ▼                       │
┌─────────────────┐              │
│  Fase 5         │◄─────────────┘
│  api-gateway    │
│  punto único    │
│  de entrada     │
│  (NestJS)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fase 6         │
│  bet-service    │
│  consulta cuotas │
│  registra bets  │
│  (NestJS)       │
└────────┬────────┘
         │
         │ bet.placed
         │ match.events (MATCH_END)
         ▼
┌─────────────────┐
│  Fase 7         │
│  settlement     │
│  liquida apuestas│
│  (NestJS)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fase 8         │
│  settlement     │
│  liquida apuestas│
│  (NestJS)       │
└────────┬────────┘
          │
          ▼
┌─────────────────┐
│  Fase 9         │
│  observabilidad │
│  Prometheus +   │
│  Grafana        │
└─────────────────┘
```

### Claves de Entendimiento

Cada fase construye sobre las anteriores siguiendo un principio de progresión natural. Primero se establece el contrato, luego la infraestructura, después los servicios que producen datos, la API Gateway como punto de entrada, y finalmente los servicios que consumen y procesan esos datos.

La conexión entre fases no es solo de dependencias técnicas sino de comprensión conceptual. Cada fase introduce conceptos que las fases posteriores dan por sentado. Sin el modelo de eventos de partido de la fase cero, no podríamos diseñar el consumo de eventos de la fase dos. Sin las cuotas publicadas a Redis en la fase tres, la consulta de partidos de la fase seis retornaría siempre vacío.

El simulador funciona como catalizador que permite verificar cada fase en aislamiento. En lugar de esperar a que toda la infraestructura esté completa, el simulador permite generar eventos de prueba desde el momento en que el odds-engine está listo para consumirlos.

---

## Criterios de Verificación Finales

El proyecto se considera completo cuando todos estos checks pasan simultáneamente:

| # | Criterio | Fase | Comando de Verificación |
|---|----------|------|------------------------|
| 1 | Stack completo levanta | 1 | `docker-compose up -d` |
| 2 | Simulador genera eventos | 4 | `pnpm --filter @betting-engine/simulator simulate -- --scenario high-volatility --speed 60x --fresh-match-ids` |
| 3 | Cuotas se actualizan en Redis | 3 | `redis-cli get "odds:sim-demo-002"` |
| 4 | **Endpoints internos NO accesibles directamente** | 5 | `curl http://localhost:3001/internal/matches` debe fallar |
| 5 | **Endpoints públicos solo vía Gateway** | 5 | `curl http://localhost:3000/matches/live` |
| 6 | Endpoint retorna partidos con cuotas | 6 | `curl http://localhost:3000/matches/live` |
| 7 | Apuesta válida retorna 201 | 7 | `curl -X POST http://localhost:3000/bets` |
| 8 | Apuesta con cuota stale retorna 409 | 7 | `curl -X POST` con odds desactualizados |
| 9 | Apuestas se liquidan al terminar | 8 | `SELECT status FROM bet_service.bets` |
| 10 | Settlement sobrevive a reinicio | 8 | `docker-compose restart settlement` |
| 11 | Tests unitarios pasan | todas | `pnpm test` |
| 12 | Healthchecks responden | todas | `curl http://localhost:3000/health` |
| 13 | Prometheus + Grafana operativos | 9 | `curl http://localhost:9090/api/v1/targets` |
| 14 | Métricas HTTP disponibles | 9 | `curl http://localhost:3000/metrics \| grep http_request` |

Estos criterios garantizan que cada componente funciona correctamente y que la integración entre componentes está verificada. La ausencia de un solo criterio indica que hay una fase incompleta o una conexión rota entre fases.

**Criterios específicos de API Gateway**:

```bash
# Verificar que la API Gateway bloquea acceso directo
curl http://localhost:3001/matches/live     # Debe fallar (odds-engine)
curl http://localhost:3002/matches/live     # Debe fallar (bet-service)
curl http://localhost:3000/matches/live     # Debe funcionar (gateway)

# Verificar autenticación
curl http://localhost:3000/bets             # Debe retornar 401
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/bets             # Debe retornar 200

# Verificar rate limiting
for i in {1..15}; do curl http://localhost:3000/matches/live; done
# Últimas peticiones deben retornar 429
```

---

## Guía de Lectura por Rol

### Para Desarrolladores Implementando el Proyecto

Leer en orden desde la Fase cero hasta la Fase nueve, prestando atención especial a las secciones de "Conexión con las Fases Anteriores y Siguientes" al final de cada fase. Estas secciones clarifican exactamente qué debe estar funcionando antes de comenzar la fase y qué dependerá de la implementación actual.

Antes de implementar cada fase, ejecutar los comandos de verificación de la fase anterior. Si algún comando falla, la causa raíz está en la fase anterior, no en la fase actual.

**Importante**: La Fase 5 (API Gateway) debe implementarse antes de exponer cualquier endpoint público. Este principio de seguridad es no negociable.

### Para Entrevistadores o Revisores Técnicos

Comenzar con la sección "Visión General del Sistema" para comprender la arquitectura completa. Luego saltar a las secciones de arquitectura hexagonal de cada fase para ver cómo se aplica el patrón en cada servicio.

Las secciones de "Flujo de Procesamiento" muestran la secuencia de operaciones de manera step-by-step, útil para preguntar sobre edge cases y manejo de errores.

Prestar especial atención a la Fase 5 (API Gateway) para verificar que el sistema cumple con el principio de "sin comunicación directa cliente-microservicios".

### Para Managers de Proyecto

La tabla de dependencias en la sección de resumen muestra el orden crítico de implementación. Cada fase tiene una duración estimada proporcional a su número de historias de usuario.

Las Fases uno, dos, tres y cuatro pueden implementarse en paralelo por diferentes desarrolladores dado que sus interfaces están definidas en el shared-kernel.

Las Fases cinco, seis, siete y ocho deben implementarse secuencialmente porque cada una depende del output de la anterior.

| Fase | Descripción | Estimación | Dependencias |
|------|-------------|------------|--------------|
| 0 | Shared Kernel | 1 día | Ninguna |
| 1 | Docker Compose | 1 día | Fase 0 |
| 2 | Odds Engine (consume) | 2 días | Fase 1 |
| 3 | Odds Engine (cuotas) | 2 días | Fase 2 |
| 4 | Simulador CLI | 2 días | Fase 1 |
| 5 | **API Gateway** | **2 días** | **Fase 1** |
| 6 | Bet Service (consulta) | 2 días | Fase 3, 5 |
| 7 | Bet Service (apuestas) | 3 días | Fase 6 |
| 8 | Settlement | 3 días | Fase 7 |
| 9 | Observabilidad (Prometheus + Grafana) | 2 días | Todas |

---

*Documento generado para guiar la implementación del Betting Engine. Cada fase es autocontenida pero construye sobre las anteriores. Seguir el orden establecido garantiza que cada componente encuentra sus dependencias disponibles al iniciar.*

*La API Gateway es un componente crítico de seguridad que garantiza que los clientes nunca se comuniquen directamente con los microservicios. Su implementación temprana (Fase 5) establece este principio desde el inicio del proyecto.*

*NestJS fue seleccionado como framework base porque su sistema de módulos (`@Module`), inyección de dependencias (`@Injectable`, `@Inject`), y soporte nativo para microservicios (`@nestjs/microservices`) se alinean perfectamente con los principios de la arquitectura hexagonal, permitiendo implementar puertos y adaptadores con mínimo boilerplate.*
