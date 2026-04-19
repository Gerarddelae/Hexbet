import { Inject, Injectable, Logger } from '@nestjs/common';
import { MatchEvent, OddsSnapshot, OddsUpdatedEvent } from '@betting-engine/shared-kernel';
import { MatchState } from '../../domain/models/match-state.model';
import { OddsPublisherPort, ODDS_PUBLISHER_PORT } from '../../domain/ports/odds-publisher.port';
import { OddsCalculatorService } from '../../domain/services/odds-calculator.service';

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
}

export interface RecalculateOddsInput {
  event: MatchEvent;
  matchState: MatchState;
}

export interface RecalculateOddsResult {
  status: 'published' | 'partial_failure' | 'failed';
  odds: OddsSnapshot;
  publication: {
    redis: 'ok' | 'failed';
    kafka: 'ok' | 'failed';
  };
}

@Injectable()
export class RecalculateOddsUseCase {
  private readonly logger = new Logger(RecalculateOddsUseCase.name);
  private readonly retryConfig: RetryConfig = { maxAttempts: 3, baseDelayMs: 100 };

  constructor(
    @Inject(OddsCalculatorService)
    private readonly oddsCalculator: OddsCalculatorService,
    @Inject(ODDS_PUBLISHER_PORT)
    private readonly oddsPublisher: OddsPublisherPort,
  ) {}

  async execute(input: RecalculateOddsInput): Promise<RecalculateOddsResult> {
    const odds = this.oddsCalculator.calculate(input.matchState, input.event);
    const kafkaEvent: OddsUpdatedEvent = {
      matchId: input.event.matchId,
      odds,
      triggeredByEventId: input.event.id,
    };

    const [redisResult, kafkaResult] = await Promise.allSettled([
      this.executeWithRetry(
        () => this.oddsPublisher.publishToRedis(input.event.matchId, odds),
        'redis',
      ),
      this.executeWithRetry(
        () => this.oddsPublisher.publishToKafka(kafkaEvent),
        'kafka',
      ),
    ]);

    const redisOk = redisResult.status === 'fulfilled';
    const kafkaOk = kafkaResult.status === 'fulfilled';

    const status: RecalculateOddsResult['status'] =
      redisOk && kafkaOk
        ? 'published'
        : redisOk || kafkaOk
          ? 'partial_failure'
          : 'failed';

    if (status !== 'published') {
      this.logger.warn(
        `Odds publication ${status} for match ${input.event.matchId}: redis=${redisOk ? 'ok' : 'failed'} kafka=${kafkaOk ? 'ok' : 'failed'}`,
      );
    }

    return {
      status,
      odds,
      publication: {
        redis: redisOk ? 'ok' : 'failed',
        kafka: kafkaOk ? 'ok' : 'failed',
      },
    };
  }

  private async executeWithRetry(work: () => Promise<void>, target: 'redis' | 'kafka'): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt += 1) {
      try {
        await work();
        return;
      } catch (error) {
        lastError = error;

        if (attempt >= this.retryConfig.maxAttempts) {
          break;
        }

        this.logger.warn(
          `Retrying ${target} publication attempt ${attempt}/${this.retryConfig.maxAttempts}`,
        );
        await this.sleep(this.retryConfig.baseDelayMs * attempt);
      }
    }

    throw lastError;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
