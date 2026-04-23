import { Controller, Get, Patch, Param, Query, Body, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { BetRepositoryPort } from '../../domain/ports/bet-repository.port.js';
import { BET_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-bet.repository.js';
import type { Bet, BetStatus } from '../../domain/entities/bet.entity.js';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port.js';
import { USER_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-user.repository.js';

export interface SettleBetDto {
  result: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';
}

@Controller('internal')
export class InternalBetsController {
  private readonly logger = new Logger(InternalBetsController.name);

  constructor(
    @Inject(BET_REPOSITORY_PORT) private readonly betRepository: BetRepositoryPort,
    @Inject(USER_REPOSITORY_PORT) private readonly userRepository: UserRepositoryPort,
  ) {}

  @Get('bets')
  async getBets(
    @Query('matchId') matchId?: string,
    @Query('status') status?: BetStatus,
  ): Promise<Bet[]> {
    try {
      if (!matchId) {
        this.logger.warn('Missing required parameter: matchId');
        return [];
      }

      if (status) {
        return await this.betRepository.findPendingByMatch(matchId, status);
      }
      return await this.betRepository.findByMatch(matchId);
    } catch (error: any) {
      this.logger.error(`Error fetching bets: ${error?.message || error}`);
      return [];
    }
  }

  @Patch('bets/:betId/settle')
  async settleBet(
    @Param('betId') betId: string,
    @Body() dto: SettleBetDto,
  ): Promise<{ message: string }> {
    try {
      const bet = await this.betRepository.findById(betId);
      if (!bet) {
        throw new NotFoundException(`Bet ${betId} not found`);
      }

      const won = this.evaluateBet(bet.selection, dto.result);
      const payout = won ? Math.floor(bet.stakeCents * bet.acceptedOdds) : 0;
      const newStatus: BetStatus = won ? 'WON' : 'LOST';

      await this.betRepository.settleBet(betId, newStatus, payout);

      if (won && payout > 0) {
        await this.userRepository.creditBalance(bet.userId, payout);
      }

      this.logger.log(`Bet ${betId} settled as ${newStatus}, payout: ${payout}`);
      return { message: `Bet settled as ${newStatus}` };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error settling bet: ${error?.message || error}`);
      throw new BadRequestException('Unable to settle bet');
    }
  }

  private evaluateBet(
    selection: Bet['selection'],
    result: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN',
  ): boolean {
    if (selection === 'HOME' && result === 'HOME_WIN') return true;
    if (selection === 'DRAW' && result === 'DRAW') return true;
    if (selection === 'AWAY' && result === 'AWAY_WIN') return true;
    return false;
  }
}