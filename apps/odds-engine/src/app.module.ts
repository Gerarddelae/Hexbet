import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessMatchEventUseCase } from './application/use-cases/process-match-event.use-case';
import { RecalculateOddsUseCase } from './application/use-cases/recalculate-odds.use-case';
import {
  MATCH_REPOSITORY_PORT,
} from './domain/ports/match-repository.port';
import { ODDS_PUBLISHER_PORT } from './domain/ports/odds-publisher.port';
import { OddsCalculatorService } from './domain/services/odds-calculator.service';
import { PostgresMatchRepository } from './infrastructure/adapters/outbound/postgres/postgres-match.repository';
import { RedisKafkaOddsPublisher } from './infrastructure/adapters/outbound/messaging/redis-kafka-odds.publisher';
import { MatchEventsConsumer } from './infrastructure/adapters/inbound/kafka/match-events.consumer';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
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
      schema: 'odds_engine',
      entities: [],
      synchronize: false,
    }),
  ],
  controllers: [HealthController, MetricsController, MatchEventsConsumer],
  providers: [
    ProcessMatchEventUseCase,
    RecalculateOddsUseCase,
    OddsCalculatorService,
    {
      provide: MATCH_REPOSITORY_PORT,
      useClass: PostgresMatchRepository,
    },
    {
      provide: ODDS_PUBLISHER_PORT,
      useClass: RedisKafkaOddsPublisher,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
