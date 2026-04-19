import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { MatchEvent } from '@betting-engine/shared-kernel';
import { ProcessMatchEventUseCase } from '../../../../application/use-cases/process-match-event.use-case';
import { RecalculateOddsUseCase } from '../../../../application/use-cases/recalculate-odds.use-case';

@Controller()
export class MatchEventsConsumer {
  private readonly logger = new Logger(MatchEventsConsumer.name);

  constructor(
    @Inject(ProcessMatchEventUseCase)
    private readonly processMatchEventUseCase: ProcessMatchEventUseCase,
    @Inject(RecalculateOddsUseCase)
    private readonly recalculateOddsUseCase: RecalculateOddsUseCase,
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

    if (!this.isUuid(event.matchId)) {
      this.logger.warn(
        `Skipping match event with invalid UUID matchId=${event.matchId} from ${topic}[${partition}]@${offset}`,
      );
      return;
    }

    try {
      const result = await this.processMatchEventUseCase.execute(event);

      if (result.status === 'processed' && result.matchState) {
        const recalculation = await this.recalculateOddsUseCase.execute({
          event,
          matchState: result.matchState,
        });

        this.logger.log(
          `PROCESSED ${event.type} for match ${event.matchId} from ${topic}[${partition}]@${offset} recalculation=${recalculation.status} redis=${recalculation.publication.redis} kafka=${recalculation.publication.kafka}`,
        );
        return;
      }

      this.logger.log(
        `DUPLICATE event ${event.type} for match ${event.matchId} from ${topic}[${partition}]@${offset}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed processing event ${event.id} (${event.type}) for match ${event.matchId} from ${topic}[${partition}]@${offset}: ${message}`,
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
