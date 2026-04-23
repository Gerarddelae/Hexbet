export interface OddsSnapshot {
  home: number;
  draw: number;
  away: number;
  timestamp: string;
}

export interface Match {
  id: string;
  status: 'NOT_STARTED' | 'LIVE' | 'FINISHED';
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  odds?: OddsSnapshot;
  updatedAt: Date;
}

export interface LiveMatchWithOdds extends Match {
  odds: OddsSnapshot;
}