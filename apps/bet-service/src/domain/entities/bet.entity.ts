export type BetSelection = 'HOME' | 'DRAW' | 'AWAY';
export type BetStatus = 'OPEN' | 'WON' | 'LOST' | 'CANCELLED';

export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  selection: BetSelection;
  acceptedOdds: number;
  stakeCents: number;
  status: BetStatus;
  createdAt: Date;
}

export interface CreateBetParams {
  id: string;
  userId: string;
  matchId: string;
  selection: BetSelection;
  acceptedOdds: number;
  stakeCents: number;
}