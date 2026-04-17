export interface OddsSnapshot {
  home: number;
  draw: number;
  away: number;
  timestamp: string;
}

export interface OddsUpdatedEvent {
  matchId: string;
  odds: OddsSnapshot;
  triggeredByEventId: string;
}
