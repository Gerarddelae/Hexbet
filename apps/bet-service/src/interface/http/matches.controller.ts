import { Controller, Get, Logger, Inject } from '@nestjs/common';
import { GetLiveMatchesUseCase } from '../../application/use-cases/get-live-matches.use-case.js';
import type { LiveMatchWithOdds } from '../../domain/entities/match.entity.js';

@Controller('matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(
    @Inject(GetLiveMatchesUseCase) private readonly getLiveMatchesUseCase: GetLiveMatchesUseCase
  ) {}

  @Get('live')
  async getLiveMatches(): Promise<LiveMatchWithOdds[]> {
    return this.getLiveMatchesUseCase.execute();
  }
}