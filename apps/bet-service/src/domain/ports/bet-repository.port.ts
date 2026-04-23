import { Bet, BetStatus } from '../entities/bet.entity';

export interface BetRepositoryPort {
  save(bet: Omit<Bet, 'createdAt'>): Promise<Bet>;
  findById(id: string): Promise<Bet | null>;
  findByUser(userId: string): Promise<Bet[]>;
  findByMatch(matchId: string): Promise<Bet[]>;
  findPendingByMatch(matchId: string, status: BetStatus): Promise<Bet[]>;
  settleBet(betId: string, status: BetStatus, payoutCents: number): Promise<void>;
  updateStatus(betId: string, status: BetStatus): Promise<void>;
}