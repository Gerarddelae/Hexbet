import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { MatchEndEvent, MatchEvent } from '@betting-engine/shared-kernel';
import { kafkaMessagesProcessed } from '@betting-engine/observability';
import { SettleMatchUseCase } from '../../../../application/use-cases/settle-match.use-case';
import { PROCESSED_MATCH_REPOSITORY } from '../../../../domain/ports/processed-match-repository.port';

@Controller()
export class MatchEventsConsumer {
  private readonly logger = new Logger(MatchEventsConsumer.name);

  constructor(
    @Inject(SettleMatchUseCase)
    private readonly settleMatchUseCase: SettleMatchUseCase,
    @Inject(PROCESSED_MATCH_REPOSITORY)
    private readonly processedMatchRepository: { exists(matchId: string): Promise<boolean>; save(matchId: string): Promise<void> },
  ) {}

  @EventPattern('match.events')
  async handleMatchEvent(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const event = this.extractEventPayload(payload);

    if (!this.isMatchEvent(event)) {
      this.logger.warn('Skipping invalid match event payload');
      return;
    }

    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    if (event.type !== 'MATCH_END') {
      this.logger.debug(
        `Ignoring ${event.type} event for match ${event.matchId} from ${topic}[${partition}]@${offset} - only MATCH_END triggers settlement`,
      );
      return;
    }

    if (!this.isUuid(event.matchId)) {
      this.logger.warn(
        `Skipping match event with invalid UUID matchId=${event.matchId} from ${topic}[${partition}]@${offset}`,
      );
      return;
    }

    try {
      const alreadyProcessed = await this.processedMatchRepository.exists(event.matchId);

      if (alreadyProcessed) {
        this.logger.log(
          `SKIP: match ${event.matchId} already processed from ${topic}[${partition}]@${offset}`,
        );
        kafkaMessagesProcessed.labels('match.events', 'MATCH_END', 'skipped').inc();
        return;
      }

      const matchEndEvent = event as MatchEndEvent;
      const result = await this.settleMatchUseCase.execute({
        matchId: matchEndEvent.matchId,
        result: matchEndEvent.payload.result,
        homeScore: matchEndEvent.payload.homeScore,
        awayScore: matchEndEvent.payload.awayScore,
      });

      await this.processedMatchRepository.save(event.matchId);

      if (result.status === 'success') {
        this.logger.log(
          `SETTLED match ${event.matchId} from ${topic}[${partition}]@${offset}: ${result.settled} bets settled`,
        );
        kafkaMessagesProcessed.labels('match.events', 'MATCH_END', 'settled').inc();
      } else {
        this.logger.warn(
          `SETTLEMENT FAILED for match ${event.matchId} from ${topic}[${partition}]@${offset}: ${result.error}`,
        );
        kafkaMessagesProcessed.labels('match.events', 'MATCH_END', 'failed').inc();
      }
    } catch (error) {
      kafkaMessagesProcessed.labels('match.events', 'MATCH_END', 'error').inc();
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed settlement for match ${event.matchId} from ${topic}[${partition}]@${offset}: ${message}`,
      );
    }
  }

  private extractEventPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const maybeKafkaEnvelope = payload as { value?: unknown };
    return maybeKafkaEnvelope.value ?? payload;
  }

  private isMatchEvent(value: unknown): value is MatchEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const event = value as Partial<MatchEvent>;

    if (
      typeof event.id !== 'string' ||
      typeof event.matchId !== 'string' ||
      typeof event.provider !== 'string' ||
      typeof event.providerEventId !== 'string' ||
      typeof event.timestamp !== 'string' ||
      typeof event.type !== 'string'
    ) {
      return false;
    }

    return (
      event.type === 'MATCH_START' ||
      event.type === 'GOAL' ||
      event.type === 'YELLOW_CARD' ||
      event.type === 'RED_CARD' ||
      event.type === 'MATCH_END'
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}