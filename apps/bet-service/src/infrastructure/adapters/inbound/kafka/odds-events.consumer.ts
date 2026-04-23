import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { Redis } from 'ioredis';
import { kafkaMessagesProcessed } from '@betting-engine/observability';

@Controller()
export class OddsEventsConsumer {
  private readonly logger = new Logger(OddsEventsConsumer.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  }

  @EventPattern('odds.updated')
  async handleOddsUpdated(
    @Payload() event: { matchId: string; odds: any },
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      const msg = context.getMessage();
      this.logger.log(`Received odds update: match ${event.matchId}`);

      await this.redis.set(`odds:${event.matchId}`, JSON.stringify(event.odds), 'EX', 300);
      kafkaMessagesProcessed.labels('odds.updated', 'ODDS_UPDATE', 'success').inc();
    } catch (error) {
      kafkaMessagesProcessed.labels('odds.updated', 'ODDS_UPDATE', 'error').inc();
      this.logger.error(`Error processing odds update: ${error}`);
    }
  }
}

export const ODDS_EVENTS_CONSUMER = 'ODDS_EVENTS_CONSUMER';