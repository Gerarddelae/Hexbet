# Resumen - Fase 5 (API Gateway)

Fecha: 2026-04-22

## Objetivo

Implementar la API Gateway como punto único de entrada para los clientes, proporcionando autenticación JWT, rate limiting y enrutamiento a los servicios backend.

## Alcance de esta entrega (MVP)

- **GatewayController**: Catch-all route que proxifica peticiones a servicios internos
- **ProxyRequestUseCase**: Caso de uso que orquesta autenticación, rate limiting y forward
- **JwtAuthAdapter**: Validador de tokens JWT para usuarios
- **HttpServiceRouterAdapter**: Forward HTTP a servicios backend
- **RedisRateLimiterAdapter**: Rate limiting con Redis
- **Route Configuration**: Definición de rutas públicas vs protegidas
- **OddsStreamGateway**: WebSocket para streaming de cuotas en tiempo real

### Bugfix: Inyección de Dependencias en API Gateway (2026-04-22)

**Problema**: La API Gateway fallaba con `Cannot read properties of undefined (reading 'execute')`. La causa raíz fueron múltiples problemas de inyección de dependencias:

1. **ProxyRequestUseCase no injectado**: NestJS no podía injectar `ProxyRequestUseCase` en `GatewayController`
2. **Tokens de string inconsistentes**: Los tokens `'AuthProviderPort'`, `'RateLimiterPort'`, `'ServiceRouterPort'` no se resolvían correctamente
3. **HttpService no injectado**: `@nestjs/axios` tiene problemas conocidos de inyección con el token `AXIOS_INSTANCE_TOKEN`

**Solución**:
- Crear constantes exportadas para tokens en `domain/ports/index.ts`
- Usar `@Inject(Token)` en todos los constructores
- Para `HttpServiceRouterAdapter`: crear instancia `axios` directamente en el constructor en lugar de usar `HttpService` de NestJS

```typescript
// domain/ports/index.ts
export const AUTH_PROVIDER_PORT = 'AUTH_PROVIDER_PORT';
export const RATE_LIMITER_PORT = 'RATE_LIMITER_PORT';
export const SERVICE_ROUTER_PORT = 'SERVICE_ROUTER_PORT';

// http-service-router.adapter.ts
constructor() {
  this.axiosInstance = axios.create({ timeout: this.timeout });
}
```

**Decisión de diseño**: Usar `axios` directamente en `HttpServiceRouterAdapter` en lugar de `HttpService` de NestJS. Esto evita los problemas de inyección documentados en la comunidad de NestJS con `@nestjs/axios`.

## Exclusiones

- No se implementó endpoint de ingestión de webhooks (queda para fase futura)
- No se implementó autenticación HMAC para proveedores externos

## Verificación y uso

Requisitos: infraestructura local levantada y servicios backend disponibles.

Comandos útiles:

```
# Levantar API Gateway
pnpm --filter @betting-engine/api-gateway dev

# Verificar health
curl http://localhost:3000/health

# Proxificar a bet-service (vía Gateway)
curl http://localhost:3000/bet-service/matches/live
```

Checks operativos:

- `pnpm --filter @betting-engine/api-gateway typecheck` — debe pasar
- `pnpm --filter @betting-engine/api-gateway build` — debe compilar

## Archivos añadidos/actualizados

- `apps/api-gateway/src/domain/ports/index.ts` — interfaces de puertos
- `apps/api-gateway/src/domain/entities/route.entity.ts` — entidad de ruta
- `apps/api-gateway/src/application/use-cases/proxy-request.use-case.ts` — caso de uso principal
- `apps/api-gateway/src/infrastructure/config/services.config.ts` — configuración de rutas
- `apps/api-gateway/src/infrastructure/adapters/jwt-auth.adapter.ts` — validador JWT
- `apps/api-gateway/src/infrastructure/adapters/http-service-router.adapter.ts` — router HTTP
- `apps/api-gateway/src/infrastructure/adapters/redis-rate-limiter.adapter.ts` — rate limiter
- `apps/api-gateway/src/interface/http/gateway.controller.ts` — controlador principal
- `apps/api-gateway/src/interface/websocket/odds-stream.gateway.ts` — WebSocket
- `apps/api-gateway/src/app.module.ts` — módulo principal actualizado
- `apps/api-gateway/package.json` — dependencias actualizadas

## Siguientes pasos recomendados

1. Integrar el bet-service para proxificar `/matches/live` y `/bets`
2. Implementar endpoint de ingestión de match events con HMAC
3. Conectar WebSocket con consumo de Kafka para broadcasting de cuotas