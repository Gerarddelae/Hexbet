# api-gateway

API Gateway del Betting Engine - Punto único de entrada.

## Endpoints

- GET /health - Health check con verificación de dependencias
- GET /:service/* - Proxy a servicios internos

## WebSocket

- Namespace: `stream/odds`
- Eventos: `subscribe`, `unsubscribe`, `odds.updated`

## Rutas Configureadas

| Path | Servicio | Auth | Rate Limit |
|------|----------|------|------------|
| /matches/** | bet-service | No | 100 req/min |
| /bets | bet-service | JWT | 10 req/min |
| /user/** | bet-service | JWT | 60 req/min |

## Scripts

- pnpm build - Compilar
- pnpm typecheck - Verificar tipos
- pnpm dev - Desarrollo