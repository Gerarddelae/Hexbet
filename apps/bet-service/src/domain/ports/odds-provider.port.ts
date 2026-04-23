import type { LiveMatchWithOdds } from '../entities/match.entity';

export interface OddsProviderPort {
  getOddsForMatch(matchId: string): Promise<LiveMatchWithOdds['odds'] | null>;
}