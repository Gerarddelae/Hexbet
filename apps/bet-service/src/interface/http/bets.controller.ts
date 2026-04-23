import { Controller, Get, Post, Body, Param, Logger, Inject } from '@nestjs/common';
import { PlaceBetUseCase, type PlaceBetInput, type PlaceBetOutput } from '../../application/use-cases/place-bet.use-case.js';
import type { BetRepositoryPort } from '../../domain/ports/bet-repository.port.js';
import type { Bet, BetSelection } from '../../domain/entities/bet.entity.js';
import { BET_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-bet.repository.js';

@Controller('bets')
export class BetsController {
  private readonly logger = new Logger(BetsController.name);

  constructor(
    private readonly placeBetUseCase: PlaceBetUseCase,
    @Inject(BET_REPOSITORY_PORT) private readonly betRepository: BetRepositoryPort,
  ) {}

  @Post()
  async placeBet(@Body() body: {
    userId: string;
    matchId: string;
    selection: BetSelection;
    stakeCents: number;
  }): Promise<PlaceBetOutput> {
    return this.placeBetUseCase.execute(body);
  }

  @Get('user/:userId')
  async getUserBets(@Param('userId') userId: string): Promise<Bet[]> {
    return this.betRepository.findByUser(userId);
  }
}