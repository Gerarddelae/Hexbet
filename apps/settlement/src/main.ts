import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

function parseKafkaBrokers(rawBrokers: string | undefined): string[] {
  return (rawBrokers ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

async function runMigrations(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER_SERVICE ?? process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD_SERVICE ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB_SERVICE ?? process.env.POSTGRES_DB ?? 'betting_engine',
    schema: 'settlement',
    entities: [],
    migrations: [__dirname + '/database/migrations/*.{ts,js}'],
  });

  await dataSource.initialize();
  console.log('Database connection established');

  const hasMigrations = await dataSource.showMigrations();
  if (hasMigrations) {
    console.log('Running pending migrations...');
    const result = await dataSource.runMigrations();
    console.log(`Migrations completed: ${result.length} applied`);
  } else {
    console.log('No pending migrations');
  }

  await dataSource.destroy();
}

async function bootstrap(): Promise<void> {
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.SETTLEMENT_PORT ?? 3003);
  const brokers = parseKafkaBrokers(
    process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER,
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID ?? 'settlement',
        brokers,
      },
      consumer: {
        groupId: process.env.KAFKA_CONSUMER_GROUP_ID ?? 'settlement-consumer',
        allowAutoTopicCreation: false,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
  console.log(`Settlement Service running on port ${port}`);
  console.log(`Settlement Kafka consumer started`);
}

void bootstrap();
