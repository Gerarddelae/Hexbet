import { Injectable, Inject } from '@nestjs/common';
import { MATCH_REPOSITORY_PORT } from '../../infrastructure/adapters/outbound/postgres/postgres-match.repository.js';
import type { MatchRepositoryPort } from '../../infrastructure/adapters/outbound/postgres/postgres-match.repository.js';
import type { LiveMatchWithOdds } from '../../domain/entities/match.entity.js';

@Injectable()
export class GetLiveMatchesUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY_PORT) private readonly matchRepository: MatchRepositoryPort
  ) {}

  async execute(): Promise<LiveMatchWithOdds[]> {
    return this.matchRepository.getLiveMatchesWithOdds();
  }
}