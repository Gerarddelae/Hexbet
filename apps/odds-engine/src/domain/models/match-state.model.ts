export type MatchStatus = 'NOT_STARTED' | 'LIVE' | 'FINISHED';

export interface MatchState {
  id: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
}

export interface ProcessedMatchEventRef {
  provider: string;
  providerEventId: string;
  matchId: string;
}
