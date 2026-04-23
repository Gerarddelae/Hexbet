import {
  Registry,
  collectDefaultMetrics,
  register,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

export {
  Registry,
  Counter,
  Histogram,
  Gauge,
  register,
};

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const kafkaMessagesProcessed = new Counter({
  name: 'kafka_messages_processed_total',
  help: 'Total number of Kafka messages processed',
  labelNames: ['topic', 'event_type', 'status'],
  registers: [registry],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['service'],
  registers: [registry],
});

export const betsPlacedTotal = new Counter({
  name: 'bets_placed_total',
  help: 'Total number of bets placed',
  labelNames: ['selection'],
  registers: [registry],
});

export const betsSettledTotal = new Counter({
  name: 'bets_settled_total',
  help: 'Total number of bets settled',
  labelNames: ['result'],
  registers: [registry],
});

export const matchEventsProcessed = new Counter({
  name: 'match_events_processed_total',
  help: 'Total number of match events processed',
  labelNames: ['event_type'],
  registers: [registry],
});

export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

export { MetricsInterceptor } from './metrics.interceptor';