import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import Redis from 'ioredis';
import { OddsSnapshot, OddsUpdatedEvent } from '@betting-engine/shared-kernel';
import { OddsPublisherPort } from '../../../../domain/ports/odds-publisher.port';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseKafkaBrokers(rawBrokers: string | undefined): string[] {
  return (rawBrokers ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

@Injectable()
export class RedisKafkaOddsPublisher implements OddsPublisherPort, OnModuleDestroy {
  private readonly logger = new Logger(RedisKafkaOddsPublisher.name);
  private readonly redis: Redis;
  private readonly kafkaProducer: Producer;
  private readonly redisTtlSeconds: number;
  private readonly oddsUpdatedTopic: string;
  private producerConnectPromise: Promise<void> | null = null;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parsePort(process.env.REDIS_PORT, 6379),
    });
    this.redisTtlSeconds = parsePort(process.env.REDIS_ODDS_TTL_SECONDS, 300);
    this.oddsUpdatedTopic = process.env.KAFKA_ODDS_UPDATED_TOPIC ?? 'odds.updated';

    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? 'odds-engine',
      brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER),
    });

    this.kafkaProducer = kafka.producer({
      allowAutoTopicCreation: false,
    });
  }

  async publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void> {
    const key = `odds:${matchId}`;
    await this.redis.set(key, JSON.stringify(odds), 'EX', this.redisTtlSeconds);
  }

  async deleteOdds(matchId: string): Promise<void> {
    const key = `odds:${matchId}`;
    await this.redis.del(key);
    this.logger.log(`Deleted odds cache for match ${matchId}`);
  }

  async publishToKafka(event: OddsUpdatedEvent): Promise<void> {
    await this.ensureProducerConnected();
    await this.kafkaProducer.send({
      topic: this.oddsUpdatedTopic,
      messages: [
        {
          key: event.matchId,
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.kafkaProducer.disconnect();
    } catch (error) {
      this.logger.warn('Error disconnecting Kafka producer');
    }

    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn('Error disconnecting Redis client');
    }
  }

  private async ensureProducerConnected(): Promise<void> {
    if (!this.producerConnectPromise) {
      this.producerConnectPromise = this.kafkaProducer.connect();
    }

    await this.producerConnectPromise;
  }
}
