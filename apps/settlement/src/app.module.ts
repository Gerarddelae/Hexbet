import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { SettleMatchUseCase } from './application/use-cases/settle-match.use-case';
import { MatchEventsConsumer } from './infrastructure/adapters/inbound/kafka/match-events.consumer';
import { BetPlacedConsumer } from './infrastructure/adapters/inbound/kafka/bet-placed.consumer';
import { BetServiceHttpClient, BET_SERVICE_HTTP_CLIENT } from './infrastructure/adapters/outbound/http/bet-service-http.client';
import { ProcessedMatchRepository } from './infrastructure/adapters/outbound/postgres/processed-match.repository';
import { PROCESSED_MATCH_REPOSITORY } from './domain/ports/processed-match-repository.port';
import { MetricsInterceptor } from '@betting-engine/observability';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

@Module({
  imports: [
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
  controllers: [HealthController, MetricsController, MatchEventsConsumer],
  providers: [
    SettleMatchUseCase,
    BetPlacedConsumer,
    {
      provide: BET_SERVICE_HTTP_CLIENT,
      useClass: BetServiceHttpClient,
    },
    {
      provide: PROCESSED_MATCH_REPOSITORY,
      useClass: ProcessedMatchRepository,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
