# Arquitectura Hexagonal y Estructura de Directorios del Betting Engine

## Propósito de Este Documento

Este documento describe cómo se organiza el código fuente del proyecto en la estructura de carpetas del monorepo, y explica cómo cada directorio, archivo y capa cumple con los principios de la arquitectura hexagonal (también conocida como Puertos y Adaptadores). El objetivo es proporcionar una guía que permita a cualquier desarrollador comprender dónde debe ir cada pieza de código y por qué.

La arquitectura hexagonal no es solo una convención de nombres de carpetas; es un principio de diseño que garantiza que la lógica de negocio permanece pura, testeable y libre de dependencias de infraestructura. Este documento muestra cómo ese principio se manifiesta en la estructura física del proyecto.

---

## 1. Estructura Global del Monorepo

### 1.1 Vista General del Árbol de Directorios

```
betting-engine/
│
├── apps/                          # Microservicios NestJS (4 independientes)
│   ├── api-gateway/               # Punto único de entrada para clientes
│   ├── odds-engine/
│   ├── bet-service/
│   └── settlement/
│
├── packages/                      # Código compartido entre servicios
│   ├── shared-kernel/             # Tipos y eventos compartidos
│   └── observability/             # Métricas Prometheus, interceptors
│
├── simulator/                     # Herramienta de desarrollo/demo
│
├── docker-compose.yml            # Orquestación de infraestructura
├── docker-compose.test.yml        # Tests de integración
├── nx.json                        # Configuración de Nx (monorepo)
├── package.json                   # Workspaces root
└── README.md
```

Esta estructura de tres niveles refleja la separación fundamental del sistema. El nivel superior contiene las aplicaciones que ejecutan lógica de negocio, incluyendo la **API Gateway** como punto único de entrada. El nivel de paquetes contiene el código que las aplicaciones comparten. El nivel del simulador contiene herramientas auxiliares que no son parte del sistema de producción pero que son esenciales para desarrollo y demostración.

La decisión de usar un monorepo con workspaces permite que los cuatro servicios compartan el paquete shared-kernel como dependencia, facilitando la importación de tipos y eventos compartidos sin duplicación de código.

---

## 2. NestJS como Framework Base

### 2.1 ¿Por Qué NestJS?

**NestJS** fue seleccionado como framework base para todos los servicios porque proporciona una arquitectura opinionada que se alinea naturalmente con los principios de la arquitectura hexagonal, mientras ofrece herramientas robustas para construir microservicios.

#### Razones de la Elección

| Característica | Beneficio para el Proyecto |
|----------------|---------------------------|
| **Arquitectura Modular** | Separa naturalmente el código en módulos que corresponden a las capas hexagonales |
| **Inyección de Dependencias Nativa** | Permite implementar "puertos" e "inyectar adaptadores" sin boilerplate |
| **Soporte para Microservicios** | Proporciona abstracciones para Kafka, Redis, TCP, RabbitMQ, etc. |
| **TypeScript First** | Tipado estático que detecta errores en tiempo de compilación |
| **Ecosistema Rico** | Guards, Interceptors, Pipes, Filters para cross-cutting concerns |
| **Testing Integrado** | TestContainers, mocks, e2e testing con configuración mínima |

#### Comparativa con Alternativas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NESTJS vs ALTERNATIVAS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Express/Fastify puro                                                   │
│  ├── Máxima flexibilidad                                                │
│  ├── Requiere construir arquitectura desde cero                         │
│  ├── DI manual o librerías externas (tsyringe, inversify)               │
│  └── Cada equipo puede diverger en estructura                           │
│                                                                         │
│  NestJS                                                                 │
│  ├── Estructura opinionada y consistente                                │
│  ├── DI nativo con decoradores (@Injectable, @Inject)                   │
│  ├── Microservicios con una línea de configuración                      │
│  └── Comunidad grande y documentación extensa                           │
│                                                                         │
│  Spring Boot / .NET Core                                                │
│  ├── Similar a NestJS en conceptos                                      │
│  ├── Requiere JVM o .NET runtime                                        │
│  └── Menos adecuado para equipos TypeScript/JavaScript                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 NestJS y Arquitectura Hexagonal

NestJS facilita la implementación de arquitectura hexagonal mediante sus decoradores y sistema de módulos:

```typescript
// apps/odds-engine/src/odds-engine.module.ts
@Module({
  // ═══════════════════════════════════════════════════════════════
  // CAPA DE INFRAESTRUCTURA - Adaptadores que implementan puertos
  // ═══════════════════════════════════════════════════════════════
  imports: [
    TypeOrmModule.forRoot({
      // Configuración PostgreSQL
    }),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: { /* config */ },
      },
    ]),
  ],
  
  // ═══════════════════════════════════════════════════════════════
  // CAPA DE INTERFACE - Controladores y Consumers
  // ═══════════════════════════════════════════════════════════════
  controllers: [
    HealthController,           // HTTP: GET /health
    MatchEventsConsumer,        // Kafka: match.events
  ],
  
  // ═══════════════════════════════════════════════════════════════
  // CAPA DE APLICACIÓN - Casos de uso
  // ═══════════════════════════════════════════════════════════════
  providers: [
    // Casos de uso
    ProcessMatchEventUseCase,
    RecalculateOddsUseCase,
    
    // ═══════════════════════════════════════════════════════════════
    // PUERTOS (Interfaces) → Adaptadores concretos
    // ═══════════════════════════════════════════════════════════════
    {
      provide: 'MatchRepositoryPort',
      useClass: PostgresMatchRepository,  // Adaptador PostgreSQL
    },
    {
      provide: 'OddsPublisherPort',
      useClass: KafkaOddsPublisher,       // Adaptador Kafka
    },
    
    // Servicios de dominio
    OddsCalculatorService,
  ],
})
export class OddsEngineModule {}
```

### 2.3 Inyección de Dependencias en NestJS

La inyección de dependencias de NestJS permite que las capas superiores dependan de abstracciones (puertos), no de implementaciones:

```typescript
// ═══════════════════════════════════════════════════════════════
// CAPA DE DOMINIO - Puerto (Interfaz abstracta)
// ═══════════════════════════════════════════════════════════════
// apps/odds-engine/src/domain/ports/match-repository.port.ts
export interface MatchRepositoryPort {
  findById(id: string): Promise<Match | null>;
  save(match: Match): Promise<Match>;
}

// ═══════════════════════════════════════════════════════════════
// CAPA DE INFRAESTRUCTURA - Adaptador (Implementación concreta)
// ═══════════════════════════════════════════════════════════════
// apps/odds-engine/src/infrastructure/adapters/outbound/postgres/postgres-match.repository.ts
@Injectable()
export class PostgresMatchRepository implements MatchRepositoryPort {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly repository: Repository<MatchEntity>,
  ) {}
  
  async findById(id: string): Promise<Match | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }
  
  // ...
}

// ═══════════════════════════════════════════════════════════════
// CAPA DE APLICACIÓN - Caso de uso (Depende del puerto, no del adaptador)
// ═══════════════════════════════════════════════════════════════
// apps/odds-engine/src/application/use-cases/process-match-event.use-case.ts
@Injectable()
export class ProcessMatchEventUseCase {
  constructor(
    @Inject('MatchRepositoryPort')
    private readonly matchRepository: MatchRepositoryPort,
    // ^^^ Solo conoce la interfaz, no la implementación
  ) {}
  
  async execute(event: MatchEvent): Promise<void> {
    const match = await this.matchRepository.findById(event.matchId);
    // Lógica de negocio pura...
  }
}
```

### 2.4 NestJS para Microservicios

NestJS proporciona un paquete dedicado `@nestjs/microservices` que simplifica la creación de microservicios con diferentes transportes:

```typescript
// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE MICROSERVICIO CON KAFKA
// ═══════════════════════════════════════════════════════════════
// apps/odds-engine/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OddsEngineModule } from './odds-engine.module';

async function bootstrap() {
  // Microservicio híbrido: HTTP + Kafka
  const app = await NestFactory.create(OddsEngineModule);
  
  // Conectar microservicio Kafka
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['kafka:9092'],
      },
      consumer: {
        groupId: 'odds-engine-consumer',
      },
    },
  });
  
  await app.startAllMicroservices();
  await app.listen(3001);
}
bootstrap();
```

#### Consumer de Eventos Kafka

```typescript
// apps/odds-engine/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { ProcessMatchEventUseCase } from '../../application/use-cases/process-match-event.use-case';

@Controller()
export class MatchEventsConsumer {
  constructor(
    private readonly processMatchEventUseCase: ProcessMatchEventUseCase,
  ) {}
  
  // Escucha el topic 'match.events'
  @EventPattern('match.events')
  async handleMatchEvent(
    @Payload() event: MatchEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    // Extraer metadata de Kafka
    const { offset, partition, topic } = context.getMessage();
    
    console.log(`Processing event from ${topic}[${partition}]@${offset}`);
    
    // Delegar al caso de uso
    await this.processMatchEventUseCase.execute(event);
  }
}
```

#### Producer de Eventos Kafka

```typescript
// apps/odds-engine/src/infrastructure/adapters/kafka-odds.publisher.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { OddsPublisherPort } from '../../domain/ports/odds-publisher.port';

@Injectable()
export class KafkaOddsPublisher implements OddsPublisherPort {
  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}
  
  async publishToKafka(event: OddsUpdatedEvent): Promise<void> {
    // Publicar al topic 'odds.updated'
    this.kafkaClient.emit('odds.updated', event);
  }
  
  async publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void> {
    // Implementación con Redis...
  }
}
```

### 2.5 NestJS en la API Gateway

La API Gateway aprovecha características específicas de NestJS:

```typescript
// apps/api-gateway/src/interface/http/gateway.controller.ts
import { All, Req, Res, Param, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyRequestUseCase } from '../../application/use-cases/proxy-request.use-case';

@Controller()
export class GatewayController {
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

#### Middleware Stack en NestJS

```typescript
// apps/api-gateway/src/interface/http/middleware/auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthAdapter } from '../../infrastructure/adapters/jwt-auth.adapter';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtAuth: JwtAuthAdapter) {}
  
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    
    const payload = await this.jwtAuth.validateToken(token);
    
    if (!payload) {
      throw new UnauthorizedException('Token inválido');
    }
    
    // Adjuntar usuario al request
    req['user'] = payload;
    next();
  }
}

// Configuración en el módulo
// apps/api-gateway/src/api-gateway.module.ts
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: 'bets/*', method: RequestMethod.ALL });
    
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

#### WebSocket Gateway para Streaming

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
  
  // Método llamado cuando llega evento de Kafka
  broadcastOddsUpdate(matchId: string, odds: OddsSnapshot): void {
    this.server.to(`match:${matchId}`).emit('odds.updated', {
      matchId,
      odds,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 2.6 Testing con NestJS

NestJS proporciona herramientas integradas para testing que facilitan la arquitectura hexagonal:

```typescript
// apps/odds-engine/test/unit/odds-calculator.spec.ts
import { Test } from '@nestjs/testing';
import { OddsCalculatorService } from '../../src/domain/services/odds-calculator.service';

describe('OddsCalculatorService', () => {
  let calculator: OddsCalculatorService;
  
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OddsCalculatorService],
    }).compile();
    
    calculator = moduleRef.get<OddsCalculatorService>(OddsCalculatorService);
  });
  
  it('should calculate higher odds for underdog', () => {
    const odds = calculator.calculate({
      currentMinute: 45,
      homeScore: 0,
      awayScore: 2,
    });
    
    expect(odds.away).toBeGreaterThan(odds.home);
  });
});
```

#### Testing de Integración con TestContainers

```typescript
// apps/odds-engine/test/integration/process-match-event.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { ProcessMatchEventUseCase } from '../../src/application/use-cases/process-match-event.use-case';

describe('ProcessMatchEvent Integration', () => {
  let useCase: ProcessMatchEventUseCase;
  let container: PostgreSqlContainer;
  
  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          // ...
        }),
      ],
      providers: [
        ProcessMatchEventUseCase,
        {
          provide: 'MatchRepositoryPort',
          useClass: PostgresMatchRepository,
        },
      ],
    }).compile();
    
    useCase = moduleRef.get<ProcessMatchEventUseCase>(ProcessMatchEventUseCase);
  }, 30000);
  
  afterAll(async () => {
    await container.stop();
  });
  
  it('should process match start event', async () => {
    const event = createMatchStartEvent();
    await useCase.execute(event);
    // Verificar en base de datos...
  });
});
```

---

## 3. El Paquete shared-kernel

### 3.1 Propósito y Ubicación

El paquete `shared-kernel` ocupa un lugar privilegiado en la arquitectura: es la única dependencia que los cuatro servicios comparten, y contiene exclusivamente tipos e interfaces sin ninguna lógica de negocio ni dependencias de frameworks.

```
packages/
└── shared-kernel/
    ├── src/
    │   ├── events/
    │   │   ├── match.events.ts      # Tipos de eventos de partido
    │   │   ├── bet.events.ts        # Tipos de eventos de apuesta
       │   │   └── odds.events.ts       # Tipos de eventos de cuotas
    │   ├── ports/
    │   │   └── match-data-provider.port.ts  # Interfaz del proveedor de datos
    │   └── index.ts                 # Exportaciones públicas
    ├── package.json
    └── tsconfig.json
```

La ubicación en `packages/` indica que este es código que se comparte entre aplicaciones pero que no es una aplicación en sí misma. A diferencia de `apps/` donde cada directorio contiene una aplicación ejecutable, `packages/` contiene bibliotecas.

### 3.2 Contenido del Contrato Compartido

**match.events.ts** define los tipos relacionados con eventos de partido: la enumeración `MatchEventType`, la interfaz `MatchEvent` con todos sus payloads, y las interfaces específicas para cada tipo de evento como `GoalPayload` o `MatchEndPayload`.

**bet.events.ts** define las interfaces `BetPlacedEvent` y `BetSettledEvent` que viajan por los topics `bet.placed` y `bet.settled`. Estas interfaces son el contrato entre el bet-service y settlement.

**odds.events.ts** define `OddsUpdatedEvent` y `OddsSnapshot` que son el resultado del procesamiento del odds-engine y la entrada para el bet-service.

**match-data-provider.port.ts** define la interfaz `IMatchDataProvider` que será implementada por el simulador. Esta es la única abstracción sobre la fuente de datos externos.

### 3.3 Principio Cumplido

El shared-kernel cumple el principio de contrato compartido porque ningún servicio necesita conocer los detalles de implementación de los demás. El settlement sabe que recibirá un `BetPlacedEvent` con cierta estructura, pero no sabe cómo el bet-service lo generó. El odds-engine sabe que debe publicar un `OddsUpdatedEvent`, pero no sabe quién lo consumirá.

La verificación de este paquete es simplemente compilar TypeScript sin errores: `tsc -p packages/shared-kernel/tsconfig.json`. Si compila, el contrato está bien definido.

---

## 4. Estructura de la API Gateway

### 4.1 Propósito de la API Gateway

La **API Gateway** es el punto único de entrada para todos los clientes del sistema. Su responsabilidad principal es:

- **Enrutamiento**: Dirigir las peticiones al microservicio correspondiente
- **Autenticación/Autorización**: Validar tokens JWT antes de permitir el acceso
- **Rate Limiting**: Proteger los servicios backend de sobrecarga
- **Transformación de Protocolos**: Convertir entre formatos si es necesario
- **Aggregación de Respuestas**: Combinar datos de múltiples servicios cuando sea necesario

**Los clientes NUNCA se comunican directamente con los microservicios**; todas las peticiones pasan obligatoriamente por la API Gateway.

### 4.2 Árbol Completo de Directorios

```
apps/api-gateway/
├── src/
│   ├── domain/                    # Lógica de enrutamiento pura
│   │   ├── entities/
│   │   │   └── route.entity.ts    # Definición de rutas
│   │   ├── ports/
│   │   │   ├── auth-provider.port.ts
│   │   │   └── service-router.port.ts
│   │   └── services/
│   │       └── route-resolver.service.ts
│   │
│   ├── application/               # Orquestación de casos de uso
│   │   ├── use-cases/
│   │   │   ├── proxy-request.use-case.ts
│   │   │   └── aggregate-response.use-case.ts
│   │   └── dto/
│   │       ├── proxy-request.dto.ts
│   │       └── gateway-response.dto.ts
│   │
│   ├── infrastructure/            # Adaptadores de tecnología
│   │   ├── adapters/
│   │   │   ├── jwt-auth.adapter.ts
│   │   │   ├── http-service-router.adapter.ts
│   │   │   └── rate-limiter.adapter.ts
│   │   └── config/
│   │       ├── services.config.ts
│   │       └── gateway.config.ts
│   │
│   ├── interface/                 # Puntos de entrada/salida
│   │   ├── http/
│   │   │   ├── gateway.controller.ts
│   │   │   ├── health.controller.ts
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts
│   │   │       ├── rate-limit.middleware.ts
│   │   │       └── request-logger.middleware.ts
│   │   └── websocket/
│   │       └── odds-stream.gateway.ts
│   │
│   └── api-gateway.module.ts      # Configuración de NestJS
│
├── test/
│   ├── unit/
│   │   └── route-resolver.spec.ts
│   └── integration/
│       └── proxy-request.spec.ts
│
├── Dockerfile
└── main.ts
```

### 4.3 Módulo Principal de la API Gateway

```typescript
// apps/api-gateway/src/api-gateway.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    HttpModule,           // Para forward requests HTTP
    JwtModule.register({  // Para validación de tokens
      secret: process.env.JWT_SECRET,
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
    
    // Puertos → Adaptadores
    {
      provide: 'ServiceRouterPort',
      useClass: HttpServiceRouterAdapter,
    },
    {
      provide: 'AuthProviderPort',
      useClass: JwtAuthAdapter,
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

### 4.4 Capa de Dominio de la API Gateway

La capa de dominio de la API Gateway contiene la lógica de enrutamiento y las reglas de negocio para el procesamiento de peticiones.

**route.entity.ts** define la entidad `Route` que representa una ruta configurada en el gateway. Incluye el path pattern, el servicio destino, métodos HTTP permitidos y si requiere autenticación.

**service-router.port.ts** define la interfaz `ServiceRouterPort` que abstrae la comunicación con los microservicios backend.

```typescript
export interface ServiceRouterPort {
  forwardRequest(route: Route, request: ProxyRequest): Promise<ProxyResponse>;
  getServiceHealth(serviceName: string): Promise<boolean>;
}
```

**route-resolver.service.ts** contiene la lógica pura para resolver qué ruta corresponde a una petición entrante y determinar el servicio destino.

### 4.5 Capa de Aplicación de la API Gateway

**proxy-request.use-case.ts** orquesta el flujo completo de proxy de una petición: validar autenticación si es requerida, aplicar rate limiting, resolver la ruta, forward al servicio destino, y retornar la respuesta.

**aggregate-response.use-case.ts** maneja los casos donde se necesita combinar datos de múltiples servicios (por ejemplo, partidos con estadísticas adicionales).

### 4.6 Capa de Infraestructura de la API Gateway

**jwt-auth.adapter.ts** implementa la validación de tokens JWT usando `@nestjs/jwt`.

**http-service-router.adapter.ts** implementa `ServiceRouterPort` usando `@nestjs/axios` para comunicarse con los microservicios. Este adaptador conoce las URLs internas de cada servicio.

**rate-limiter.adapter.ts** implementa rate limiting usando Redis para almacenar contadores por IP o por usuario.

### 4.7 Capa de Interface de la API Gateway

**gateway.controller.ts** expone el endpoint catch-all que recibe todas las peticiones de clientes: `ALL /{service}/**`. Este controlador delega al `ProxyRequestUseCase`.

**odds-stream.gateway.ts** implementa WebSocket para streaming de cuotas en tiempo real a los clientes, evitando polling constante.

---

## 5. Estructura del Odds Engine

### 5.1 Árbol Completo de Directorios

```
apps/odds-engine/
├── src/
│   ├── domain/                    # Lógica de negocio pura
│   │   ├── entities/
│   │   │   ├── match.entity.ts
│   │   │   └── odds.entity.ts
│   │   ├── ports/
│   │   │   ├── match-repository.port.ts
│   │   │   └── odds-publisher.port.ts
│   │   └── services/
│   │       └── odds-calculator.service.ts
│   │
│   ├── application/               # Orquestación de casos de uso
│   │   ├── use-cases/
│   │   │   ├── process-match-event.use-case.ts
│   │   │   └── recalculate-odds.use-case.ts
│   │   └── dto/
│   │       └── match-event.dto.ts
│   │
│   ├── infrastructure/            # Adaptadores de tecnología
│   │   ├── adapters/
│   │   │   ├── postgres-match.repository.ts
│   │   │   ├── redis-odds.publisher.ts
│   │   │   └── kafka-odds.publisher.ts
│   │   └── config/
│   │       └── kafka.config.ts
│   │
│   ├── interface/                 # Puntos de entrada/salida
│   │   ├── http/
│   │   │   ├── internal/          # Solo accesible desde API Gateway
│   │   │   │   └── match.controller.ts
│   │   │   └── health.controller.ts
│   │   └── kafka/
│   │       └── match-events.consumer.ts
│   │
│   └── odds-engine.module.ts      # Configuración de NestJS
│
├── test/
│   ├── unit/
│   │   └── odds-calculator.spec.ts
│   └── integration/
│       └── process-match-event.spec.ts
│
├── Dockerfile
└── main.ts
```

### 5.2 Configuración del Microservicio

```typescript
// apps/odds-engine/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OddsEngineModule } from './odds-engine.module';

async function bootstrap() {
  // Crear aplicación híbrida: HTTP + Microservicio
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

### 5.3 Capa de Dominio

La capa de dominio contiene las entidades y los servicios que representan la lógica de negocio central del odds-engine. Esta es la capa más importante del servicio porque contiene el conocimiento que no debería cambiar si se reemplaza la base de datos, el broker de mensajes, o cualquier otra tecnología.

**match.entity.ts** define la entidad `Match` que representa el estado de un partido. Esta clase conoce qué datos definen un partido pero no sabe cómo se persisten. Los campos incluyen identificador, equipo local, equipo visitante, marcador actual, minuto actual, estado del partido y cuotas actuales.

**odds.entity.ts** define la interfaz `OddsSnapshot` que representa las cuotas de un partido. Esta interfaz es el mismo tipo exportado por shared-kernel, pero el archivo local demuestra cómo se documenta y organiza en el contexto del servicio.

**match-repository.port.ts** define la interfaz `MatchRepositoryPort`. Esta es la abstracción sobre el almacenamiento de partidos. El dominio declara qué operaciones necesita (crear, leer, actualizar), pero no sabe si se implementan con PostgreSQL, MongoDB, o un archivo JSON.

```typescript
export interface MatchRepositoryPort {
  findById(id: string): Promise<Match | null>;
  findByProviderAndEventId(provider: string, eventId: string): Promise<MatchEventLog | null>;
  save(match: Match): Promise<Match>;
  saveEventLog(log: MatchEventLog): Promise<void>;
  update(match: Match): Promise<Match>;
}
```

**odds-publisher.port.ts** define la interfaz `OddsPublisherPort` que el dominio usa para publicar cuotas actualizadas. Nuevamente, el dominio no sabe si la implementación usa Redis, Kafka, o ambos.

```typescript
export interface OddsPublisherPort {
  publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void>;
  publishToKafka(event: OddsUpdatedEvent): Promise<void>;
}
```

**odds-calculator.service.ts** contiene la implementación del `OddsCalculator` con el modelo de probabilidades descrito en el documento de cronología. Este es código puramente funcional: dados ciertos inputs, produce ciertos outputs sin efectos secundarios ni dependencias externas.

### 5.4 Consumer de Kafka en NestJS

```typescript
// apps/odds-engine/src/infrastructure/adapters/inbound/kafka/match-events.consumer.ts
import { Controller, Logger } from '@nestjs/common';
import { 
  EventPattern, 
  Payload, 
  Ctx, 
  KafkaContext,
  KafkaRetriableException,
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
    const consumer = context.getConsumer();
    
    this.logger.log(
      `Processing event from ${topic}[${partition}]@${offset}: ${event.type}`,
    );
    
    try {
      await this.processMatchEventUseCase.execute(event);
      
      // Commit manual del offset después de procesar exitosamente
      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(offset) + BigInt(1)).toString() },
      ]);
      
      this.logger.log(`Event processed successfully: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to process event ${event.id}:`, error);
      
      // Lanzar excepción retriable para que Kafka reintente
      throw new KafkaRetriableException(error.message);
    }
  }
}
```

### 5.5 Capa de Aplicación

La capa de aplicación contiene los casos de uso que orquestan el flujo de negocio. Cada caso de uso representa una acción que el sistema puede realizar en respuesta a un estímulo externo.

**process-match-event.use-case.ts** es el caso de uso que responde cuando llega un evento de partido del simulador. Su responsabilidad es: recibir el evento, verificar idempotencia, actualizar el estado del partido según el tipo de evento, y delegar el recálculo de cuotas.

La implementación no accede directamente a la base de datos ni a Redis. En su lugar, usa los puertos definidos en la capa de dominio. Esto permite testear el flujo completo sin necesidad de infraestructura.

**recalculate-odds.use-case.ts** es el caso de uso que ejecuta el recálculo de cuotas después de un evento que lo desencadena (GOAL, RED_CARD, etc.). Recibe el partido actualizado, usa el OddsCalculator del dominio, y publica el resultado.

### 5.6 Adaptador Kafka con NestJS

```typescript
// apps/odds-engine/src/infrastructure/adapters/kafka-odds.publisher.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { OddsPublisherPort } from '../../domain/ports/odds-publisher.port';
import { OddsUpdatedEvent, OddsSnapshot } from '@betting-engine/shared-kernel';

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
```

### 5.7 Capa de Infraestructura

La capa de infraestructura contiene los adaptadores que implementan los puertos definidos en el dominio. Aquí es donde la tecnología concreta se elige y se configura.

**postgres-match.repository.ts** implementa `MatchRepositoryPort` usando TypeORM para interactuar con PostgreSQL. Este archivo conoce la estructura de las tablas, los queries SQL, y cómo mapear los resultados a las entidades del dominio.

**redis-odds.publisher.ts** implementa la parte Redis de `OddsPublisherPort` usando la biblioteca `ioredis`. Este adaptador sabe cómo serializar las cuotas a JSON, qué formato usar para la clave, y cuál es el TTL apropiado.

### 5.8 Capa de Interface

La capa de interface contiene los controladores que reciben las solicitudes externas y las transforman en llamadas a los casos de uso de la capa de aplicación.

**match.controller.ts** (en `internal/`) expone los endpoints HTTP internos que solo son accesibles desde la API Gateway:
- `GET /internal/matches` - Lista de partidos activos
- `GET /internal/matches/:id` - Detalle de un partido
- `GET /internal/matches/:id/events` - Eventos de un partido

**health.controller.ts** expone el endpoint `GET /health` que verifica el estado del servicio. Este endpoint es accesible solo desde la red interna (healthchecks de Docker/orquestador).

**match-events.consumer.ts** es el consumer de Kafka que suscribe al topic `match.events`. Este archivo transforma los mensajes de Kafka en llamadas al `ProcessMatchEventUseCase`. Es la frontera entre el mundo exterior y el dominio.

---

## 6. Estructura del Bet Service

### 6.1 Árbol Completo de Directorios

```
apps/bet-service/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── bet.entity.ts
│   │   │   └── user.entity.ts
│   │   ├── ports/
│   │   │   ├── bet-repository.port.ts
│   │   │   └── odds-reader.port.ts
│   │   └── services/
│   │       └── bet-validator.service.ts
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── place-bet.use-case.ts
│   │   │   └── get-live-matches.use-case.ts
│   │   └── dto/
│   │       ├── place-bet.dto.ts
│   │       └── live-match.dto.ts
│   │
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── postgres-bet.repository.ts
│   │   │   └── redis-odds.reader.ts
│   │   └── config/
│   │       └── kafka.config.ts
│   │
│   ├── interface/
│   │   ├── http/
│   │   │   ├── public/              # Expuesto via API Gateway
│   │   │   │   ├── bet.controller.ts
│   │   │   │   └── match.controller.ts
│   │   │   ├── internal/            # Solo servicios internos
│   │   │   │   └── bets.controller.ts
│   │   │   └── health.controller.ts
│   │   └── kafka/
│   │       └── odds-updated.consumer.ts
│   │
│   └── bet-service.module.ts
│
├── test/
│   ├── unit/
│   │   └── bet-validator.spec.ts
│   └── integration/
│       └── place-bet.spec.ts
│
├── Dockerfile
└── main.ts
```

### 6.2 Módulo Principal con Configuración de Kafka

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

### 6.3 Capa de Dominio del Bet Service

La capa de dominio del bet-service contiene las entidades `Bet` y `User` que representan los conceptos centrales del servicio de apuestas. La diferencia clave con las entidades del odds-engine es que estas entidades tienen comportamiento: el `BetValidator` define reglas de negocio sobre cómo se pueden crear y validar las apuestas.

**bet.entity.ts** define la entidad `Bet` con todos sus campos incluyendo el estado que evoluciona a lo largo del ciclo de vida de la apuesta: desde `PENDING` hasta `WON`, `LOST`, o `CANCELLED`.

**user.entity.ts** define la entidad `User` con el campo `balanceCents` que representa el saldo disponible del usuario. Esta entidad no tiene mucha lógica porque el saldo se modifica desde el servicio, pero conocer su estructura es importante para entender cómo se valida el límite de apuesta.

**bet-repository.port.ts** define la interfaz `BetRepositoryPort` con las operaciones necesarias: crear apuesta, buscar apuesta por ID, buscar apuestas pendientes por partido, actualizar apuesta. El dominio no sabe cómo se implementan estas operaciones.

**odds-reader.port.ts** define la interfaz `OddsReaderPort` que permite consultar las cuotas actuales de un partido. Esta abstracción permite que el dominio valide cuotas sin saber si vienen de Redis, de una llamada HTTP al odds-engine, o de otro fuente.

```typescript
export interface OddsReaderPort {
  getOdds(matchId: string): Promise<OddsSnapshot | null>;
}
```

**bet-validator.service.ts** contiene todas las reglas de validación de apuestas. Este servicio es la pieza más importante del dominio porque contiene el conocimiento de negocio sobre límites, cuotas válidas, y condiciones de apuesta.

### 6.4 Publicación de Eventos con NestJS

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
    
    // Publicar a Kafka
    this.kafkaClient.emit('bet.placed', {
      key: bet.userId,  // Particionamiento por usuario
      value: event,
    });
  }
}
```

### 6.5 Consumer de Kafka

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

### 6.6 Capa de Aplicación del Bet Service

**place-bet.use-case.ts** orquestra el flujo completo de registrar una apuesta. Este caso de uso: recibe los datos de la apuesta del cliente (via API Gateway), obtiene las cuotas actuales de Redis, valida todos los criterios, ejecuta la transacción de base de datos, y publica el evento de apuesta registrada.

La implementación sigue un patrón claro de pasos que facilita el testing y la comprensión del flujo completo.

**get-live-matches.use-case.ts** consulta los partidos disponibles con sus cuotas. Este caso de uso delega la consulta de cuotas al adaptador de Redis y formatea los resultados para el cliente.

### 6.7 Capa de Infraestructura del Bet Service

**postgres-bet.repository.ts** implementa `BetRepositoryPort` usando TypeORM con PostgreSQL. Este adaptador conoce la estructura de las tablas `users` y `bets` del schema `bet_service`.

**redis-odds.reader.ts** implementa `OddsReaderPort` leyendo del Redis cache donde el odds-engine publica las cuotas. La clave sigue el patrón `odds:{matchId}` y el valor es un JSON con las tres cuotas.

### 6.8 Capa de Interface del Bet Service

**bet.controller.ts** (en `public/`) expone los endpoints HTTP públicos que son accesibles a través de la API Gateway:
- `GET /matches/live` - Partidos disponibles con cuotas
- `POST /bets` - Registrar una nueva apuesta

**match.controller.ts** (en `public/`) expone endpoints relacionados con partidos:
- `GET /matches/:id` - Detalle de un partido
- `GET /matches/:id/odds` - Cuotas históricas de un partido

**bets.controller.ts** (en `internal/`) expone los endpoints internos usados por Settlement:
- `GET /internal/bets` - Obtener apuestas pendientes
- `PATCH /internal/bets/:betId/settle` - Liquidar una apuesta

Estos endpoints **NO** están expuestos en la API Gateway y solo son accesibles desde la red interna de Docker.

**odds-updated.consumer.ts** consume el topic `odds.updated` de Kafka. Cuando llega un evento de cuotas actualizadas, el consumidor puede actualizar una caché local o simplemente confiar en que Redis ya tiene los datos actualizados.

---

## 7. Estructura del Settlement Service

### 7.1 Árbol Completo de Directorios

```
apps/settlement/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── settlement-record.entity.ts
│   │   ├── ports/
│   │   │   └── settlement-repository.port.ts
│   │   └── services/
│   │       └── settlement-calculator.service.ts
│   │
│   ├── application/
│   │   └── use-cases/
│   │       └── settle-match.use-case.ts
│   │
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   └── postgres-settlement.repository.ts
│   │   │   └── http-bet-service.client.ts
│   │   └── config/
│   │       └── kafka.config.ts
│   │
│   ├── interface/
│   │   ├── http/
│   │   │   └── health.controller.ts
│   │   └── kafka/
│   │       ├── match-end.consumer.ts
│   │       ├── bet-placed.consumer.ts
│   │       └── dlq.producer.ts
│   │
│   └── settlement.module.ts
│
├── test/
│   ├── unit/
│   │   └── settlement-calculator.spec.ts
│   └── integration/
│       └── settle-match.spec.ts
│
├── Dockerfile
└── main.ts
```

### 7.2 Configuración del Microservicio Settlement

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

### 7.3 Capa de Dominio del Settlement

La capa de dominio del settlement es la más pequeña de los cuatro servicios porque el settlement tiene una responsabilidad muy específica: evaluar apuestas y acreditarlas.

**settlement-record.entity.ts** define la entidad `ProcessedMatch` que representa un partido que ya fue liquidado. Esta entidad solo tiene dos campos relevantes: el matchId y el resultado.

**settlement-repository.port.ts** define la interfaz `SettlementRepositoryPort` con operaciones para verificar si un partido fue procesado y para registrar el procesamiento.

**settlement-calculator.service.ts** contiene la lógica pura de evaluar una apuesta. Dado el resultado del partido y la selección del usuario, determina si la apuesta ganó o perdió. Esta lógica es completamente determinista y testeable sin ninguna dependencia externa.

### 7.4 Consumer de Match End

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

### 7.5 Manejo de Dead Letter Queue

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

### 7.6 Capa de Aplicación del Settlement

**settle-match.use-case.ts** es el caso de uso central del servicio. Su flujo es: verificar idempotencia, obtener apuestas pendientes del bet-service, evaluar cada apuesta, actualizar cada apuesta en bet-service, publicar eventos de liquidación, y registrar el partido como procesado.

Este caso de uso es el más complejo en términos de orquestación porque involucra comunicación con el bet-service y múltiples publicaciones a Kafka.

### 7.7 Capa de Infraestructura del Settlement

**postgres-settlement.repository.ts** implementa el repositorio de settlements usando PostgreSQL. La tabla `processed_matches` tiene el matchId como primary key, lo que garantiza idempotencia a nivel de base de datos.

**http-bet-service.client.ts** es el cliente HTTP que Settlement usa para comunicarse con el bet-service. Este adaptador implementa las llamadas a los endpoints internos: obtener apuestas pendientes y actualizar estado de apuesta.

### 7.8 Capa de Interface del Settlement

**match-end.consumer.ts** consume el topic `match.events` filtrando solo eventos de tipo `MATCH_END`. Cuando llega uno, invoca el caso de uso de liquidación.

**bet-placed.consumer.ts** consume el topic `bet.placed`. Dependiendo de la estrategia de implementación, Settlement puede procesar apuestas en tiempo real o acumularlas para procesarlas cuando llegue el `MATCH_END`. El archivo existe pero puede estar vacío si se elige procesar todo en el consumer de `MATCH_END`.

**dlq.producer.ts** produce mensajes al Dead Letter Queue cuando el procesamiento de una apuesta falla después de todos los reintentos.

---

## 8. Estructura del Simulador

### 8.1 Árbol Completo de Directorios

```
simulator/
├── src/
│   ├── scenarios/                     # Datos de escenarios
│   │   ├── normal-match.json
│   │   └── high-volatility.json
│   │
│   ├── adapters/
│   │   └── simulator-match-data.adapter.ts
│   │       # Implementa IMatchDataProvider del shared-kernel
│   │
│   ├── kafka-producer.service.ts      # Publicador a Kafka
│   ├── scenario-runner.ts             # Orquestador de escenarios
│   ├── cli.ts                        # Interface de línea de comandos
│   │
│   └── mapper/
│       └── scenario-event.mapper.ts   # Transformación de eventos
│
├── test/
│   └── scenario-event-mapper.spec.ts
│
├── package.json
└── Dockerfile
```

### 8.2 Arquitectura del Simulador

El simulador es un programa standalone que sigue los mismos principios de arquitectura hexagonal adaptados a su contexto. La diferencia principal es que el simulador solo tiene una capa de infraestructura: produce eventos, no los consume.

**simulator-match-data.adapter.ts** implementa la interfaz `IMatchDataProvider` del shared-kernel. Esta implementación es un stub que no se usa activamente en el simulador, pero demuestra cómo se conectaría un proveedor de datos real.

**scenario-runner.ts** es el orquestador que lee el escenario JSON, calcula los delays entre eventos según el factor de velocidad, y publica los eventos a Kafka.

**scenario-event.mapper.ts** transforma los eventos del formato del escenario al formato canónico `MatchEvent` definido en shared-kernel. Genera UUIDs, calcula timestamps, y asegura que el provider sea `'simulator'`.

---

## 9. Comunicación entre Servicios

### 9.1 Flujo de Comunicación con API Gateway

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE COMUNICACIÓN                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   CLIENTE                                                               │
│      │                                                                  │
│      │ HTTP/WebSocket                                                    │
│      ▼                                                                  │
│   ┌─────────────────┐                                                   │
│   │  API Gateway    │  ← Punto único de entrada                        │
│   │  (NestJS)       │    - @nestjs/common (HTTP)                        │
│   │                 │    - @nestjs/websockets (WS)                      │
│   │                 │    - @nestjs/jwt (Auth)                           │
│   └────────┬────────┘                                                   │
│            │                                                            │
│            ├─────────────────┬─────────────────┐                        │
│            │                 │                 │                        │
│            ▼                 ▼                 ▼                        │
│   ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐              │
│   │  Odds Engine    │ │ Bet Service │ │   Settlement    │              │
│   │  (NestJS)       │ │  (NestJS)   │ │   (NestJS)      │              │
│   │                 │ │             │ │                 │              │
│   │ @nestjs/        │ │ @nestjs/    │ │ @nestjs/        │              │
│   │ microservices   │ │ microservices│ │ microservices  │              │
│   │ Transport.KAFKA │ │ Transport.   │ │ Transport.KAFKA│              │
│   │                 │ │ KAFKA        │ │                │              │
│   └─────────────────┘ └─────────────┘ └─────────────────┘              │
│            │                 │                 │                        │
│            └─────────────────┼─────────────────┘                        │
│                              │                                          │
│                         Kafka Events                                    │
│                    @nestjs/microservices                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Configuración de Transportes en NestJS

NestJS `@nestjs/microservices` soporta múltiples transportes:

```typescript
// Ejemplo de configuración para diferentes transportes

// KAFKA (usado en el proyecto)
const kafkaConfig = {
  transport: Transport.KAFKA,
  options: {
    client: { brokers: ['kafka:9092'] },
    consumer: { groupId: 'my-consumer' },
  },
};

// REDIS (alternativa)
const redisConfig = {
  transport: Transport.REDIS,
  options: {
    host: 'redis',
    port: 6379,
  },
};

// TCP (comunicación directa)
const tcpConfig = {
  transport: Transport.TCP,
  options: {
    host: 'service',
    port: 3001,
  },
};

// RABBITMQ
const rabbitConfig = {
  transport: Transport.RMQ,
  options: {
    urls: ['amqp://rabbitmq:5672'],
    queue: 'my_queue',
  },
};
```

### 9.3 Reglas de Comunicación

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Cliente → API Gateway** | Toda comunicación de clientes pasa por el gateway | `GET /matches/live` |
| **API Gateway → Servicios** | El gateway forward requests a servicios backend | Proxy a bet-service |
| **Servicios → Servicios** | Comunicación asíncrona vía Kafka | `odds.updated`, `bet.placed` |
| **Servicios → Servicios (sync)** | Solo para operaciones que requieren consistencia inmediata | Settlement → Bet Service |

### 9.4 Endpoints Públicos vs Internos

**Endpoints Públicos** (accesibles via API Gateway):
- `GET /matches/live` - Listar partidos en vivo
- `GET /matches/:id` - Detalle de partido
- `POST /bets` - Crear apuesta
- `GET /bets` - Listar apuestas del usuario
- `GET /bets/:id` - Detalle de apuesta
- `WS /stream/odds` - WebSocket para cuotas en tiempo real

**Endpoints Internos** (solo red interna):
- `GET /internal/matches` - Odds Engine (usado por Gateway)
- `GET /internal/bets` - Bet Service (usado por Settlement)
- `PATCH /internal/bets/:id/settle` - Bet Service (usado por Settlement)
- `GET /health` - Todos los servicios (usado por orquestador)

---

## 10. Principios de Arquitectura Hexagonal Aplicados

### 10.1 Separación de Responsabilidades

Cada capa tiene una responsabilidad clara y no la comparte con otras:

| Capa | Responsabilidad | Dependencias |
|------|----------------|--------------|
| **Domain** | Lógica de negocio pura | Ninguna (solo tipos de shared-kernel) |
| **Application** | Orquestación de casos de uso | Domain |
| **Infrastructure** | Implementación de puertos | Domain (para interfaces), tecnología específica |
| **Interface** | Transformación de entrada/salida | Application, Infrastructure |

La flecha de dependencia siempre apunta hacia el dominio. El dominio no conoce a la aplicación, la aplicación no conoce a la infraestructura, y la infraestructura no conoce a la interface. Esta dirección de dependencias es la garantía de que la lógica de negocio permanece aislada.

### 10.2 El Dominio No Conoce a Kafka ni a PostgreSQL

El archivo más pequeño del dominio de cualquier servicio no debería mencionar las palabras "Kafka", "PostgreSQL", "Redis", ni ninguna tecnología específica. Si el dominio necesita comunicar que algo cambió, lo hace mediante interfaces (puertos) que la infraestructura implementa.

Ejemplo del odds-engine: el dominio tiene `OddsPublisherPort` con métodos `publishToRedis` y `publishToKafka`. El dominio sabe que necesita publicar a dos lugares, pero no sabe cómo se hace. La implementación concreta está en `infrastructure/adapters/`.

### 10.3 Tests Unitarios en la Capa de Dominio

Los tests unitarios deben poder ejecutarse sin levantar Docker, sin base de datos, y sin Kafka. Esto solo es posible porque el dominio no tiene dependencias de infraestructura.

Un test del `OddsCalculator` solo necesita importar el servicio y llamar a sus métodos con diferentes inputs:

```typescript
describe('OddsCalculator', () => {
  it('should calculate higher odds for underdog', () => {
    const calculator = new OddsCalculator();
    const odds = calculator.calculate({
      currentMinute: 45,
      homeScore: 0,
      awayScore: 2
    });
    expect(odds.away).toBeGreaterThan(odds.home);
  });
});
```

No hay mock de base de datos, no hay mock de Kafka, no hay mock de Redis. El test es puro porque el código que testa es puro.

### 10.4 Tests de Integración en la Capa de Infraestructura

Los tests de integración verifican que los adaptadores se conectan correctamente con sus tecnologías. Estos tests SÍ necesitan infraestructura: PostgreSQL real, Redis real, Kafka real.

NestJS con TestContainers permite levantar contenedores temporales para cada test:

```typescript
describe('PostgresMatchRepository', () => {
  let repository: PostgresMatchRepository;
  let container: PostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    repository = new PostgresMatchRepository(container.getConnection());
  });

  afterAll(async () => {
    await container.stop();
  });

  it('should persist and retrieve a match', async () => {
    const match = new Match({ homeTeam: 'Real Madrid', awayTeam: 'Barcelona' });
    await repository.save(match);
    const retrieved = await repository.findById(match.id);
    expect(retrieved.homeTeam).toBe('Real Madrid');
  });
});
```

---

## 11. Evolución de la Estructura por Fase de Implementación

### 11.1 Fase 0: Estructura Inicial

```
packages/shared-kernel/
├── src/
│   ├── events/
│   ├── ports/
│   └── index.ts
└── package.json
```

En esta fase solo existe el paquete shared-kernel. Los cuatro servicios aún no se han creado. El objetivo es definir el contrato antes de implementarlo.

### 11.2 Fase 1: Estructura con Docker Compose

La estructura de carpetas no cambia en esta fase porque solo se añade `docker-compose.yml` en la raíz del proyecto. Sin embargo, este archivo define cómo se desplegarán los cuatro servicios.

### 11.3 Fase 2: Odds Engine Mínimo

```
apps/odds-engine/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── match.entity.ts
│   │   └── ports/
│   │       └── match-repository.port.ts
│   ├── application/
│   │   └── use-cases/
│   │       └── process-match-event.use-case.ts
│   ├── infrastructure/
│   │   └── adapters/
│   │       └── postgres-match.repository.ts
│   └── interface/
│       └── kafka/
│           └── match-events.consumer.ts
├── odds-engine.module.ts
├── main.ts
└── Dockerfile
```

Esta es la estructura mínima del odds-engine: solo lo necesario para consumir eventos y persistirlos. La carpeta `domain/services/` está vacía porque el cálculo de cuotas aún no existe. La carpeta `test/unit/` tiene el test del use case.

### 11.4 Fase 3: Odds Engine Completo

```
apps/odds-engine/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── match.entity.ts
│   │   │   └── odds.entity.ts
│   │   ├── ports/
│   │   │   ├── match-repository.port.ts
│   │   │   └── odds-publisher.port.ts     # Nuevo
│   │   └── services/
│   │       └── odds-calculator.service.ts  # Nuevo
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── process-match-event.use-case.ts
│   │   │   └── recalculate-odds.use-case.ts  # Nuevo
│   │   └── dto/
│   │       └── match-event.dto.ts
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── postgres-match.repository.ts
│   │   │   ├── redis-odds.publisher.ts      # Nuevo
│   │   │   └── kafka-odds.publisher.ts     # Nuevo
│   │   └── config/
│   │       └── kafka.config.ts
│   └── interface/
│       ├── http/
│       │   └── health.controller.ts
│       └── kafka/
│           └── match-events.consumer.ts
├── odds-engine.module.ts
├── main.ts
└── Dockerfile
```

Los archivos añadidos en esta fase están marcados con "# Nuevo". La estructura general no cambia, solo se expande con nuevos archivos en las capas existentes.

### 11.5 Fase 4: API Gateway

```
apps/api-gateway/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── route.entity.ts
│   │   ├── ports/
│   │   │   ├── auth-provider.port.ts
│   │   │   └── service-router.port.ts
│   │   └── services/
│   │       └── route-resolver.service.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   └── proxy-request.use-case.ts
│   │   └── dto/
│   │       ├── proxy-request.dto.ts
│   │       └── gateway-response.dto.ts
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── jwt-auth.adapter.ts
│   │   │   ├── http-service-router.adapter.ts
│   │   │   └── rate-limiter.adapter.ts
│   │   └── config/
│   │       ├── services.config.ts
│   │       └── gateway.config.ts
│   └── interface/
│       ├── http/
│       │   ├── gateway.controller.ts
│       │   ├── health.controller.ts
│       │   └── middleware/
│       │       ├── auth.middleware.ts
│       │       ├── rate-limit.middleware.ts
│       │       └── request-logger.middleware.ts
│       └── websocket/
│           └── odds-stream.gateway.ts
├── api-gateway.module.ts
├── main.ts
└── Dockerfile
```

La API Gateway se implementa en esta fase para establecer el punto único de entrada antes de exponer endpoints públicos.

### 11.6 Fase 5: Bet Service Estructura Inicial

```
apps/bet-service/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── bet.entity.ts
│   │   │   └── user.entity.ts
│   │   ├── ports/
│   │   │   └── odds-reader.port.ts
│   │   └── services/
│   │       └── bet-validator.service.ts     # Añadido en fase 6
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── get-live-matches.use-case.ts  # Fase 5
│   │   │   └── place-bet.use-case.ts         # Fase 6
│   │   └── dto/
│   │       ├── live-match.dto.ts
│   │       └── place-bet.dto.ts               # Fase 6
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── redis-odds.reader.ts
│   │   │   └── postgres-bet.repository.ts      # Fase 6
│   │   └── config/
│   │       └── kafka.config.ts
│   └── interface/
│       ├── http/
│       │   ├── public/
│       │   │   ├── bet.controller.ts
│       │   │   └── match.controller.ts
│       │   └── health.controller.ts
│       └── kafka/
│           └── odds-updated.consumer.ts
├── bet-service.module.ts
├── main.ts
└── Dockerfile
```

### 11.7 Fase 6: Settlement Estructura Completa

```
apps/settlement/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── settlement-record.entity.ts
│   │   ├── ports/
│   │   │   └── settlement-repository.port.ts
│   │   └── services/
│   │       └── settlement-calculator.service.ts
│   ├── application/
│   │   └── use-cases/
│   │       └── settle-match.use-case.ts
│   ├── infrastructure/
│   │   ├── adapters/
│   │   │   ├── postgres-settlement.repository.ts
│   │   │   └── http-bet-service.client.ts
│   │   └── config/
│   │       └── kafka.config.ts
│   └── interface/
│       ├── http/
│       │   └── health.controller.ts
│       └── kafka/
│           ├── match-end.consumer.ts
│           ├── bet-placed.consumer.ts
│           └── dlq.producer.ts
├── settlement.module.ts
├── main.ts
└── Dockerfile
```

---

## 12. Convenciones de Nombrado

### 12.1 Archivos de Entidad

Cada entidad del dominio se representa con un archivo `*.entity.ts`. El nombre es singular y en camelCase: `match.entity.ts`, `bet.entity.ts`.

### 12.2 Archivos de Puerto

Cada puerto se representa con un archivo `*.port.ts`. El nombre incluye el sustantivo del dominio y la palabra "Port": `MatchRepositoryPort`, `OddsPublisherPort`.

### 12.3 Archivos de Servicio de Dominio

Los servicios que contienen lógica de negocio van en `domain/services/`. El nombre describe qué hace el servicio: `OddsCalculatorService`, `BetValidatorService`.

### 12.4 Archivos de Caso de Uso

Los casos de uso van en `application/use-cases/`. El nombre sigue el patrón "verbo-en-infinitivo + sustantivo": `ProcessMatchEventUseCase`, `PlaceBetUseCase`.

### 12.5 Archivos de Adaptador

Los adaptadores van en `infrastructure/adapters/`. El nombre combina el nombre de la tecnología y el puerto que implementa: `PostgresMatchRepository`, `RedisOddsReader`, `KafkaOddsPublisher`.

### 12.6 Archivos de Controlador

Los controladores HTTP van en `interface/http/`. Los consumers de Kafka, al ser adaptadores de entrada, se colocan en `infrastructure/adapters/inbound/kafka/`. El nombre describe el recurso que manejan: `BetController`, `MatchEventsConsumer`.

---

## 13. Verificación de Cumplimiento de Arquitectura

### 13.1 Regla del Dominio Puro

Para verificar que el dominio no conoce a la infraestructura, ejecutar el siguiente comando que busca nombres de tecnologías en los archivos de dominio:

```bash
# Buscar menciones de tecnologías en la capa de dominio
grep -r "kafka\|postgres\|redis\|typeorm\|ioredis\|kafkajs" apps/*/src/domain/
```

El resultado debe estar vacío o solo contener comentarios explicativos. Si hay imports de estas bibliotecas en los archivos del dominio, la arquitectura se ha violado.

### 13.2 Regla de Imports

Los imports en cada capa deben seguir la dirección de las flechas de dependencia:

- **Domain** solo puede importar de `packages/shared-kernel` y de otros archivos del dominio.
- **Application** puede importar de domain y de shared-kernel.
- **Infrastructure** puede importar de domain, application, shared-kernel, y de bibliotecas de tecnología.
- **Interface** puede importar de todas las capas y de bibliotecas de tecnología.

Un linter configurado correctamente puede enforce estas reglas automáticamente.

### 13.3 Regla de Tests

Los tests unitarios en `test/unit/` deben poder ejecutarse sin Docker:

```bash
# Este comando no debería requerir ningún servicio externo
npm run test:unit --workspace=apps/odds-engine
```

Si los tests unitarios fallan porque Redis no está disponible, los tests están en la capa equivocada o tienen dependencias que no deberían tener.

### 13.4 Regla de API Gateway

Para verificar que los clientes no pueden acceder directamente a los microservicios:

```bash
# Estos comandos deben fallar (no expuestos públicamente)
curl http://localhost:3001/internal/matches      # Odds Engine - debe fallar
curl http://localhost:3002/internal/bets         # Bet Service - debe fallar

# Estos comandos deben funcionar (via API Gateway)
curl http://localhost:3000/matches/live          # Gateway → Bet Service
curl http://localhost:3000/bets                  # Gateway → Bet Service
```

---

## 14. Guía Rápida de Referencia

### 14.1 Dónde Crear Cada Tipo de Archivo

| Tipo de Archivo | Ubicación | Ejemplo |
|-----------------|-----------|---------|
| Entidad del dominio | `src/domain/entities/` | `match.entity.ts` |
| Puerto/Interfaz | `src/domain/ports/` | `match-repository.port.ts` |
| Servicio de negocio | `src/domain/services/` | `odds-calculator.service.ts` |
| Caso de uso | `src/application/use-cases/` | `process-match-event.use-case.ts` |
| DTO de request/response | `src/application/dto/` | `place-bet.dto.ts` |
| Adaptador PostgreSQL | `src/infrastructure/adapters/` | `postgres-match.repository.ts` |
| Adaptador Redis | `src/infrastructure/adapters/` | `redis-odds.publisher.ts` |
| Adaptador Kafka | `src/infrastructure/adapters/` | `kafka-odds.publisher.ts` |
| Controlador HTTP público | `src/interface/http/public/` | `bet.controller.ts` |
| Controlador HTTP interno | `src/interface/http/internal/` | `bets.controller.ts` |
| Consumer Kafka | `src/infrastructure/adapters/inbound/kafka/` | `match-events.consumer.ts` |
| Configuración | `src/infrastructure/config/` | `kafka.config.ts` |
| Test unitario | `test/unit/` | `odds-calculator.spec.ts` |
| Test de integración | `test/integration/` | `process-match-event.spec.ts` |

### 14.2 Flujo de Creación de una Nueva Funcionalidad

1. **Definir en dominio**: Si la funcionalidad involucra lógica de negocio, empezar por crear las entidades y puertos necesarios en `domain/`.

2. **Implementar puertos en infraestructura**: Crear los adaptadores que implementan los puertos en `infrastructure/adapters/`.

3. **Crear caso de uso en aplicación**: Crear el use case en `application/use-cases/` que orquesta el flujo usando los puertos.

4. **Exponer en interface**: Crear el controlador HTTP (en `public/` o `internal/` según corresponda) que recibe las solicitudes y las delega al caso de uso.

5. **Registrar en API Gateway**: Si es un endpoint público, añadir la ruta correspondiente en la configuración de la API Gateway.

6. **Escribir tests**: Crear tests unitarios del dominio y tests de integración de la infraestructura.

---

*Este documento sirve como guía de implementación y referencia para la estructura del proyecto. Mantener actualizada esta documentación junto con el código asegura que cualquier nuevo desarrollador pueda entender rápidamente la organización del proyecto y dónde debe agregar nuevas funcionalidades.*

*NestJS fue seleccionado como framework base porque su sistema de módulos, inyección de dependencias y soporte para microservicios se alinean naturalmente con los principios de la arquitectura hexagonal, permitiendo implementar puertos y adaptadores con mínimo boilerplate.*
