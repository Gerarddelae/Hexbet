import { Bet, BetStatus } from '../entities/bet.entity';

export interface BetRepositoryPort {
  save(bet: Omit<Bet, 'createdAt'>): Promise<Bet>;
  findById(id: string): Promise<Bet | null>;
  findByUser(userId: string): Promise<Bet[]>;
  updateStatus(betId: string, status: BetStatus): Promise<void>;
}