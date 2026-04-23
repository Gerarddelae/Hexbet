import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { ClientKafka } from '@nestjs/microservices';
import { BetPlacedEvent } from '@betting-engine/shared-kernel';

@Injectable()
export class BetPlacedConsumer {
  private readonly logger = new Logger(BetPlacedConsumer.name);
  private readonly pendingBets = new Map<string, BetPlacedEvent[]>();

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafkaClient.connect();
  }

  @EventPattern('bet.placed')
  async handleBetPlaced(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const event = this.extractEventPayload(payload);

    if (!this.isBetPlacedEvent(event)) {
      this.logger.warn('Skipping invalid bet.placed payload');
      return;
    }

    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `Received bet.placed for match ${event.matchId} bet ${event.betId} user ${event.userId} from ${topic}[${partition}]@${offset}`,
    );

    const betsForMatch = this.pendingBets.get(event.matchId) ?? [];
    betsForMatch.push(event);
    this.pendingBets.set(event.matchId, betsForMatch);
  }

  getBetsForMatch(matchId: string): BetPlacedEvent[] {
    return this.pendingBets.get(matchId) ?? [];
  }

  clearBetsForMatch(matchId: string): void {
    this.pendingBets.delete(matchId);
  }

  private extractEventPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const maybeKafkaEnvelope = payload as { value?: unknown };
    return maybeKafkaEnvelope.value ?? payload;
  }

  private isBetPlacedEvent(value: unknown): value is BetPlacedEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const event = value as Partial<BetPlacedEvent>;

    return (
      typeof event.betId === 'string' &&
      typeof event.userId === 'string' &&
      typeof event.matchId === 'string' &&
      typeof event.selection === 'string' &&
      typeof event.acceptedOdds === 'number' &&
      typeof event.stakeCents === 'number'
    );
  }
}