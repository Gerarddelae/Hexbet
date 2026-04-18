import { Controller, Get } from '@nestjs/common';
import { Socket } from 'node:net';

interface ServiceCheck {
  host: string;
  port: number;
  reachable: boolean;
}

interface HealthPayload {
  service: string;
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    kafka: ServiceCheck;
    postgres: ServiceCheck;
    redis: ServiceCheck;
  };
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseKafkaBroker(rawBrokers: string | undefined): { host: string; port: number } {
  const firstBroker = rawBrokers?.split(',')[0]?.trim() ?? 'localhost:9092';
  const [host, portText] = firstBroker.split(':');

  return {
    host: host || 'localhost',
    port: parsePort(portText, 9092),
  };
}

async function tcpCheck(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let resolved = false;

    const finish = (value: boolean): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

@Controller('health')
export class HealthController {
  @Get()
  async health(): Promise<HealthPayload> {
    const kafka = parseKafkaBroker(process.env.KAFKA_BROKERS);
    const postgres = {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parsePort(process.env.POSTGRES_PORT, 5432),
    };
    const redis = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parsePort(process.env.REDIS_PORT, 6379),
    };

    const [kafkaReachable, postgresReachable, redisReachable] = await Promise.all([
      tcpCheck(kafka.host, kafka.port),
      tcpCheck(postgres.host, postgres.port),
      tcpCheck(redis.host, redis.port),
    ]);

    const payload: HealthPayload = {
      service: 'api-gateway',
      status: kafkaReachable && postgresReachable && redisReachable ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        kafka: { ...kafka, reachable: kafkaReachable },
        postgres: { ...postgres, reachable: postgresReachable },
        redis: { ...redis, reachable: redisReachable },
      },
    };

    return payload;
  }
}
