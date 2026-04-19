import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessMatchEventUseCase } from './application/use-cases/process-match-event.use-case';
import {
  MATCH_REPOSITORY_PORT,
} from './domain/ports/match-repository.port';
import { PostgresMatchRepository } from './infrastructure/adapters/outbound/postgres/postgres-match.repository';
import { MatchEventsConsumer } from './infrastructure/adapters/inbound/kafka/match-events.consumer';
import { HealthController } from './health.controller';

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
  controllers: [HealthController, MatchEventsConsumer],
  providers: [
    ProcessMatchEventUseCase,
    {
      provide: MATCH_REPOSITORY_PORT,
      useClass: PostgresMatchRepository,
    },
  ],
})
export class AppModule {}
