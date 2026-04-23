import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port.js';
import type { BetRepositoryPort } from '../../domain/ports/bet-repository.port.js';
import type { OddsProviderPort } from '../../domain/ports/odds-provider.port.js';
import type { Bet, BetSelection } from '../../domain/entities/bet.entity.js';
import { USER_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-user.repository.js';
import { BET_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-bet.repository.js';
import { ODDS_PROVIDER_PORT } from '../../infrastructure/adapters/outbound/redis/redis-odds.provider.js';

export interface PlaceBetInput {
  userId: string;
  matchId: string;
  selection: BetSelection;
  stakeCents: number;
}

export interface PlaceBetOutput {
  success: boolean;
  bet?: Bet;
  error?: string;
}

@Injectable()
export class PlaceBetUseCase {
  private readonly logger = new Logger(PlaceBetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT) private readonly userRepository: UserRepositoryPort,
    @Inject(BET_REPOSITORY_PORT) private readonly betRepository: BetRepositoryPort,
    @Inject(ODDS_PROVIDER_PORT) private readonly oddsProvider: OddsProviderPort,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetOutput> {
    const { userId, matchId, selection, stakeCents } = input;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.balanceCents < stakeCents) {
      return { success: false, error: 'Insufficient balance' };
    }

    const odds = await this.oddsProvider.getOddsForMatch(matchId);
    if (!odds) {
      return { success: false, error: 'Match not found or not available' };
    }

    const acceptedOdds = Number(odds[selection.toLowerCase() as keyof typeof odds]);
    if (!acceptedOdds) {
      return { success: false, error: 'Invalid selection' };
    }

    const deducted = await this.userRepository.deductBalance(userId, stakeCents);
    if (!deducted) {
      return { success: false, error: 'Failed to deduct balance' };
    }

    const bet = await this.betRepository.save({
      id: uuidv4(),
      userId,
      matchId,
      selection,
      acceptedOdds,
      stakeCents,
      status: 'OPEN',
    });

    this.logger.log(`Bet placed: ${bet.id} by user ${userId} for ${stakeCents} cents at ${acceptedOdds} odds`);

    return { success: true, bet };
  }
}

export const PLACE_BET_USE_CASE = 'PLACE_BET_USE_CASE';