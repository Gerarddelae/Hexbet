import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { MatchEvent } from '@betting-engine/shared-kernel';
import { ProcessMatchEventUseCase } from '../../../../application/use-cases/process-match-event.use-case';

@Controller()
export class MatchEventsConsumer {
  private readonly logger = new Logger(MatchEventsConsumer.name);

  constructor(private readonly processMatchEventUseCase: ProcessMatchEventUseCase) {}

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

    const result = await this.processMatchEventUseCase.execute(event);
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `${result.toUpperCase()} event ${event.type} for match ${event.matchId} from ${topic}[${partition}]@${offset}`,
    );
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
}
