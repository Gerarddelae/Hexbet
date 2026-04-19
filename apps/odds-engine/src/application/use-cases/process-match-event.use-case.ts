import { Inject, Injectable } from '@nestjs/common';
import { MatchEvent } from '@betting-engine/shared-kernel';
import {
  MatchRepositoryPort,
  MATCH_REPOSITORY_PORT,
} from '../../domain/ports/match-repository.port';
import { MatchState } from '../../domain/models/match-state.model';

export type ProcessMatchEventResult =
  | {
      status: 'processed';
      matchState: MatchState;
    }
  | {
      status: 'duplicate';
      matchState: null;
    };

@Injectable()
export class ProcessMatchEventUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY_PORT)
    private readonly matchRepository: MatchRepositoryPort,
  ) {}

  async execute(event: MatchEvent): Promise<ProcessMatchEventResult> {
    return this.matchRepository.withTransaction(async (tx) => {
      const isNewEvent = await tx.markEventAsProcessed({
        provider: event.provider,
        providerEventId: event.providerEventId,
        matchId: event.matchId,
      });

      if (!isNewEvent) {
        return {
          status: 'duplicate',
          matchState: null,
        };
      }

      const current = await tx.findMatchById(event.matchId);
      const next = this.applyEvent(current, event);

      await tx.saveMatch(next);
      return {
        status: 'processed',
        matchState: next,
      };
    });
  }

  private applyEvent(current: MatchState | null, event: MatchEvent): MatchState {
    const base = current ?? this.newMatch(event.matchId);

    switch (event.type) {
      case 'MATCH_START':
        return {
          ...base,
          status: 'LIVE',
          currentMinute: 0,
        };
      case 'GOAL':
        return {
          ...base,
          status: this.normalizeLiveStatus(base.status),
          homeScore: this.normalizeNonNegativeNumber(event.payload.homeScore, base.homeScore),
          awayScore: this.normalizeNonNegativeNumber(event.payload.awayScore, base.awayScore),
          currentMinute: this.normalizeNonNegativeNumber(event.payload.minute, base.currentMinute),
        };
      case 'YELLOW_CARD':
      case 'RED_CARD':
        return {
          ...base,
          status: this.normalizeLiveStatus(base.status),
          currentMinute: this.normalizeNonNegativeNumber(event.payload.minute, base.currentMinute),
        };
      case 'MATCH_END':
        return {
          ...base,
          status: 'FINISHED',
          homeScore: this.normalizeNonNegativeNumber(event.payload.homeScore, base.homeScore),
          awayScore: this.normalizeNonNegativeNumber(event.payload.awayScore, base.awayScore),
          currentMinute: this.normalizeNonNegativeNumber(event.payload.minute, base.currentMinute),
        };
    }
  }

  private newMatch(matchId: string): MatchState {
    return {
      id: matchId,
      status: 'NOT_STARTED',
      homeScore: 0,
      awayScore: 0,
      currentMinute: 0,
    };
  }

  private normalizeLiveStatus(status: MatchState['status']): MatchState['status'] {
    return status === 'FINISHED' ? 'FINISHED' : 'LIVE';
  }

  private normalizeNonNegativeNumber(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value < 0) {
      return fallback;
    }

    return value;
  }
}
