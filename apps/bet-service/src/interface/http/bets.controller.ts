import { Controller, Get, Post, Body, Param, Logger, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { PlaceBetUseCase, type PlaceBetInput, type PlaceBetOutput } from '../../application/use-cases/place-bet.use-case.js';
import type { BetRepositoryPort } from '../../domain/ports/bet-repository.port.js';
import type { Bet, BetSelection } from '../../domain/entities/bet.entity.js';
import { BET_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-bet.repository.js';

@Controller('bets')
export class BetsController {
  private readonly logger = new Logger(BetsController.name);

  constructor(
    @Inject(PlaceBetUseCase) private readonly placeBetUseCase: PlaceBetUseCase,
    @Inject(BET_REPOSITORY_PORT) private readonly betRepository: BetRepositoryPort,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async placeBet(@Body() body: {
    userId: string;
    matchId: string;
    selection: BetSelection;
    stakeCents: number;
  }): Promise<PlaceBetOutput> {
    try {
      return await this.placeBetUseCase.execute(body);
    } catch (error: any) {
      this.logger.error(`Error placing bet: ${error?.message || error}`);
      return { success: false, error: 'Unable to process bet. Please try again.' };
    }
  }

  @Get('user/:userId')
  async getUserBets(@Param('userId') userId: string): Promise<Bet[]> {
    try {
      return await this.betRepository.findByUser(userId);
    } catch (error: any) {
      this.logger.error(`Error fetching user bets: ${error?.message || error}`);
      return [];
    }
  }
}