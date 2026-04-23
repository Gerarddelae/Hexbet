import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { MatchResult, BetSettledEvent, BetSettlementStatus } from '@betting-engine/shared-kernel';
import { BetServiceHttpClient, BetServiceBet, BET_SERVICE_HTTP_CLIENT } from '../../infrastructure/adapters/outbound/http/bet-service-http.client';

export interface SettleMatchInput {
  matchId: string;
  result: MatchResult;
  homeScore: number;
  awayScore: number;
}

export interface SettleMatchOutput {
  status: 'success' | 'failed';
  settled: number;
  failed: number;
  error?: string;
}

@Injectable()
export class SettleMatchUseCase {
  private readonly logger = new Logger(SettleMatchUseCase.name);

  constructor(
    @Inject(BET_SERVICE_HTTP_CLIENT)
    private readonly betServiceClient: BetServiceHttpClient,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async execute(input: SettleMatchInput): Promise<SettleMatchOutput> {
    this.logger.log(`Settling match ${input.matchId} with result ${input.result}`);

    const openBets = await this.betServiceClient.getBetsForMatch(input.matchId, 'OPEN');

    if (openBets.length === 0) {
      this.logger.log(`No open bets for match ${input.matchId}`);
      return { status: 'success', settled: 0, failed: 0 };
    }

    let settled = 0;
    let failed = 0;

    for (const bet of openBets) {
      const result = this.evaluateBet(bet, input.result);

      const success = await this.betServiceClient.settleBet(bet.id, input.result);

      if (success) {
        await this.publishBetSettledEvent({
          betId: bet.id,
          userId: bet.userId,
          matchId: input.matchId,
          status: result.status,
          payoutCents: result.status === 'WON' ? Math.floor(bet.stakeCents * bet.acceptedOdds) : 0,
          timestamp: new Date().toISOString(),
        });
        settled++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Settlement complete for match ${input.matchId}: ${settled} settled, ${failed} failed`,
    );

    return {
      status: failed === 0 ? 'success' : 'failed',
      settled,
      failed,
    };
  }

  private evaluateBet(
    bet: BetServiceBet,
    matchResult: MatchResult,
  ): { status: BetSettlementStatus } {
    const won =
      (bet.selection === 'HOME' && matchResult === 'HOME_WIN') ||
      (bet.selection === 'DRAW' && matchResult === 'DRAW') ||
      (bet.selection === 'AWAY' && matchResult === 'AWAY_WIN');

    return {
      status: won ? 'WON' : 'LOST',
    };
  }

  private async publishBetSettledEvent(event: BetSettledEvent): Promise<void> {
    try {
      this.kafkaClient.emit('bet.settled', {
        key: event.userId,
        value: event,
      });

      this.logger.log(
        `Published bet.settled for bet ${event.betId} status ${event.status}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to publish bet.settled for bet ${event.betId}: ${message}`);
    }
  }
}