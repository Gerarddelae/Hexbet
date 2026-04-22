import { Kafka, type Producer } from 'kafkajs';
import type { MatchEvent } from '@betting-engine/shared-kernel';

function parseKafkaBrokers(raw: string | undefined): string[] {
  return (raw ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

export class KafkaProducerService {
  private readonly producer: Producer;
  private readonly topic: string;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? 'simulator-cli',
      brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER),
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
    });

    this.topic = process.env.KAFKA_MATCH_EVENTS_TOPIC ?? 'match.events';
  }

  async publishMatchEvent(event: MatchEvent): Promise<void> {
    await this.connect();
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: event.matchId,
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.connectPromise = null;
  }

  private async connect(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.producer.connect();
    }

    await this.connectPromise;
  }
}