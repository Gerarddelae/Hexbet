import { Module, Logger, Inject } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MatchesController } from './interface/http/matches.controller.js';
import { BetsController } from './interface/http/bets.controller.js';
import { InternalBetsController } from './interface/http/internal-bets.controller.js';
import { HealthController } from './health.controller.js';
import { MetricsController } from './metrics.controller.js';
import { GetLiveMatchesUseCase } from './application/use-cases/get-live-matches.use-case.js';
import { PlaceBetUseCase } from './application/use-cases/place-bet.use-case.js';
import { PostgresUserRepository, USER_REPOSITORY_PORT } from './infrastructure/adapters/outbound/postgres/postgres-user.repository.js';
import { PostgresBetRepository, BET_REPOSITORY_PORT } from './infrastructure/adapters/outbound/postgres/postgres-bet.repository.js';
import { PostgresMatchRepository, MATCH_REPOSITORY_PORT } from './infrastructure/adapters/outbound/postgres/postgres-match.repository.js';
import { RedisOddsProvider, ODDS_PROVIDER_PORT } from './infrastructure/adapters/outbound/redis/redis-odds.provider.js';
import { OddsEventsConsumer } from './infrastructure/adapters/inbound/kafka/odds-events.consumer.js';
import { MetricsInterceptor } from '@betting-engine/observability';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parsePort(process.env.POSTGRES_PORT, 5432),
      username: process.env.POSTGRES_USER_SERVICE ?? process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD_SERVICE ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB_SERVICE ?? process.env.POSTGRES_DB ?? 'betting_engine',
      synchronize: false,
    }),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
          producer: { allowAutoTopicCreation: false },
        },
      },
    ]),
  ],
  controllers: [MatchesController, BetsController, InternalBetsController, HealthController, MetricsController, OddsEventsConsumer],
  providers: [
    GetLiveMatchesUseCase,
    PlaceBetUseCase,
    {
      provide: USER_REPOSITORY_PORT,
      useClass: PostgresUserRepository,
    },
    {
      provide: BET_REPOSITORY_PORT,
      useClass: PostgresBetRepository,
    },
    {
      provide: MATCH_REPOSITORY_PORT,
      useClass: PostgresMatchRepository,
    },
    {
      provide: ODDS_PROVIDER_PORT,
      useClass: RedisOddsProvider,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);
}