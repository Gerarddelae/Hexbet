export type BetSelection = 'HOME' | 'DRAW' | 'AWAY';

export interface BetPlacedEvent {
  betId: string;
  userId: string;
  matchId: string;
  selection: BetSelection;
  acceptedOdds: number;
  stakeCents: number;
  timestamp: string;
}

export type BetSettlementStatus = 'WON' | 'LOST' | 'VOID';

export interface BetSettledEvent {
  betId: string;
  userId: string;
  matchId: string;
  status: BetSettlementStatus;
  payoutCents: number;
  timestamp: string;
}
