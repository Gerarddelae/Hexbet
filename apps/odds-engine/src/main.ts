import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

function parseKafkaBrokers(rawBrokers: string | undefined): string[] {
  return (rawBrokers ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.ODDS_ENGINE_PORT ?? 3001);
  const brokers = parseKafkaBrokers(
    process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER,
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID ?? 'odds-engine',
        brokers,
      },
      consumer: {
        groupId: process.env.KAFKA_CONSUMER_GROUP_ID ?? 'odds-engine-consumer',
        allowAutoTopicCreation: false,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
