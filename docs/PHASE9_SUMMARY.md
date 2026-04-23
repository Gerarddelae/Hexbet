# Resumen - Fase 9 (Observabilidad con Prometheus + Grafana)

Fecha: 2026-04-23

## Objetivo

Implementar observabilidad para el Betting Engine mediante Prometheus + Grafana, permitiendo monitorear métricas de infraestructura, tráfico HTTP y estado de los servicios.

## Lo Implementado

### 1. Package `@betting-engine/observability`

**Ubicación**: `packages/observability/`

Package compartido con métricas pre-configuradas para instrumentar todos los servicios.

```typescript
// Métricas disponibles
export const httpRequestDuration    // Histograma de latencia HTTP
export const httpRequestTotal       // Contador de requests HTTP
export const kafkaMessagesProcessed // Contador de mensajes Kafka
export const activeConnections      // Conexiones activas
export const betsPlacedTotal        // Apuestas colocadas
export const betsSettledTotal      // Apuestas liquidadas
export const matchEventsProcessed   // Eventos de partido

// Endpoint
export async function getMetrics(): Promise<string>
```

### 2. MetricsInterceptor

**Archivo**: `packages/observability/src/metrics.interceptor.ts`

Interceptor que registra automáticamente todas las peticiones HTTP:

```typescript
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Registra: method, path, status_code
    // Métricas: http_request_duration_seconds, http_request_total
  }
}
```

### 3. MetricsController en Cada Servicio

**Endpoint**: `GET /metrics` (formato Prometheus)

Agregado a todos los servicios:
- `apps/api-gateway/src/metrics.controller.ts`
- `apps/odds-engine/src/metrics.controller.ts`
- `apps/bet-service/src/metrics.controller.ts`
- `apps/settlement/src/metrics.controller.ts`

```typescript
@Controller('metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }
}
```

### 4. Docker Compose - Prometheus + Grafana

**Archivo**: `docker-compose.yml`

```yaml
prometheus:
  image: prom/prometheus:v2.47.0
  ports: [9090:9090]
  volumes:
    - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro

grafana:
  image: grafana/grafana:10.2.0
  ports: [3001:3000]  # Accede en localhost:3001
  environment:
    GF_SECURITY_ADMIN_USER: admin
    GF_SECURITY_ADMIN_PASSWORD: admin
```

### 5. Configuración Prometheus

**Archivo**: `infra/prometheus/prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'api-gateway'
    static_configs: [{ targets: ['host.docker.internal:3000'] }]
  - job_name: 'odds-engine'
    static_configs: [{ targets: ['host.docker.internal:3001'] }]
  - job_name: 'bet-service'
    static_configs: [{ targets: ['host.docker.internal:3002'] }]
  - job_name: 'settlement'
    static_configs: [{ targets: ['host.docker.internal:3003'] }]
```

### 6. Grafana Pre-configurado

**Archivos de provisioning automático**:
- `infra/grafana/provisioning/datasources/datasources.yml`
- `infra/grafana/provisioning/dashboards/dashboards.yml`
- `infra/grafana/provisioning/dashboards/betting-engine.json`

**Datasources**: Prometheus (URL: `http://prometheus:9090`)

### 7. Endpoint de Autenticación (Dev)

**Archivo**: `apps/api-gateway/src/interface/http/gateway.controller.ts`

```typescript
@All('auth/token')
async handleAuthToken(@Req() req: Request, @Res() res: Response): Promise<void> {
  if (req.method === 'POST') {
    const { userId, email } = req.body;
    const token = await this.jwtAuthAdapter.generateToken({ userId, email });
    res.status(201).json({ token });
  }
}
```

**Uso**:
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid","email":"test@test.com"}'
```

### 8. Interceptor Global en Todos los Servicios

Agregado `APP_INTERCEPTOR` con `MetricsInterceptor` en:

| Servicio | Archivo |
|----------|---------|
| api-gateway | `apps/api-gateway/src/app.module.ts` |
| odds-engine | `apps/odds-engine/src/app.module.ts` |
| bet-service | `apps/bet-service/src/app.module.ts` |
| settlement | `apps/settlement/src/app.module.ts` |

## Estructura de Archivos

```
├── packages/observability/
���   ├── src/
│   │   ├── index.ts                  # Métricas y exports
│   │   └── metrics.interceptor.ts    # Interceptor HTTP
│   └── package.json
├── infra/
│   ├── prometheus/
│   │   └── prometheus.yml           # Config de scraping
│   └── grafana/provisioning/
│       ├── datasources/datasources.yml
│       └── dashboards/
│           ├── dashboards.yml
│           └── betting-engine.json  # Dashboard pre-configurado
├── apps/
│   ├── api-gateway/src/
│   │   ├── app.module.ts            # + MetricsInterceptor
│   │   └── metrics.controller.ts
│   ├── odds-engine/src/
│   │   ├── app.module.ts            # + MetricsInterceptor
│   │   └── metrics.controller.ts
│   ├── bet-service/src/
│   │   ├── app.module.ts            # + MetricsInterceptor
│   │   └── metrics.controller.ts
│   └── settlement/src/
│       ├── app.module.ts            # + MetricsInterceptor
│       └── metrics.controller.ts
└── docker-compose.yml                # + prometheus, grafana
```

## Verificación y Uso

### URLs de Acceso

| Servicio | URL |
|----------|-----|
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin/admin) |

### Verificar Métricas

```bash
# Métricas de cada servicio
curl http://localhost:3000/metrics
curl http://localhost:3001/metrics
curl http://localhost:3002/metrics
curl http://localhost:3003/metrics

# Ver targets en Prometheus
curl http://localhost:9090/api/v1/targets

# Queries útiles en Grafana
rate(http_requests_total[5m])
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Comandos Docker

```bash
# Levantar toda la infraestructura
pnpm docker:up

# Solo Prometheus + Grafana (si ya tienes infraestructura)
pnpm docker:prometheus

# Scripts agregados al package.json
pnpm docker:prometheus  # Levanta prometheus y grafana
```

## Flujo de Pruebas Completo

### Paso 1: Levantar Todo

```bash
# Terminal 1: Infraestructura
pnpm docker:up

# Terminal 2: Servicios
pnpm --filter @betting-engine/api-gateway dev
pnpm --filter @betting-engine/odds-engine dev
pnpm --filter @betting-engine/bet-service dev
pnpm --filter @betting-engine/settlement dev

# Terminal 3: Simulador (opcional)
pnpm --filter @betting-engine/simulator simulate -- --scenario normal-match --speed 60x --fresh-match-ids
```

### Paso 2: Generar JWT y Hacer Apuesta

```bash
# 1. Ver partidos disponibles
curl http://localhost:3000/bet-service/matches/live

# 2. Generar token JWT
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","email":"test@test.com"}' \
  | jq -r '.token')

# 3. Crear apuesta
curl -X POST http://localhost:3000/bet-service/bets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","matchId":"MATCH_ID","selection":"HOME","stakeCents":1000}'

# 4. Verificar en Grafana
# http://localhost:3001 → Dashboard "Bet Engine"
```

## Métricas Disponibles

### De Infraestructura (automáticas)
- `process_cpu_seconds_total` - CPU
- `process_resident_memory_bytes` - Memoria RSS
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_heap_used_bytes` - Heap usado

### HTTP (via MetricsInterceptor)
- `http_requests_total{method, route, status_code}` - Contador
- `http_request_duration_seconds{method, route, status_code}` - Histograma

### Negocio (definidas, disponibles para uso)
- `bets_placed_total{selection}` - Apuestas creadas
- `bets_settled_total{result}` - Apuestas liquidadas
- `kafka_messages_processed_total{topic, event_type, status}` - Mensajes Kafka
- `match_events_processed_total{event_type}` - Eventos de partido

## Verificaciones de Calidad

- `pnpm typecheck` - ✅ Passing
- `pnpm build` - ✅ Passing

## Mejoras Futuras Consideradas

- [ ] Agregar Grafana Tempo para distributed tracing
- [x] Instrumentar Kafka consumers con métricas custom (✅ Implementado)
- [ ] Agregar métricas de negocio en use-cases
- [ ] Configurar alertas en Prometheus
- [ ] Dashboards adicionales por servicio

## Notas Importantes

1. **URL datasource en Grafana**: Usar `http://prometheus:9090` (no `localhost:9090`) para comunicación entre contenedores.

2. **Interceptors**: El MetricsInterceptor registra todas las peticiones HTTP. Los servicios internos (odds-engine, settlement) solo registran tráfico interno (peticiones del gateway hacia ellos).

3. **Puerto Grafana**: Usa puerto `3001` para evitar conflicto con API Gateway en `3000`.

## Estado

| Componente | Estado |
|-----------|--------|
| Package observability | ✅ Implementado |
| MetricsInterceptor | ✅ Implementado |
| MetricsController (todos los servicios) | ✅ Implementado |
| Docker Compose (Prometheus + Grafana) | ✅ Implementado |
| Prometheus config | ✅ Implementado |
| Grafana provisioning | ✅ Implementado |
| Endpoint /auth/token | ✅ Implementado |
| Métricas Kafka en consumers | ✅ Implementado |
| Typecheck/Build | ✅ Passing |

## Instrumentación de Kafka (agregada)

Todos los consumers de Kafka ahora registran métricas:

| Consumer | Servicio | Topic | Métricas |
|----------|----------|-------|----------|
| MatchEventsConsumer | odds-engine | match.events | processed, duplicate, error |
| OddsEventsConsumer | bet-service | odds.updated | success, error |
| MatchEventsConsumer | settlement | match.events | settled, skipped, failed, error |
| BetPlacedConsumer | settlement | bet.placed | success, invalid, error |