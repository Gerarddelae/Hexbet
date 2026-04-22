import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Match } from '../../../../domain/entities/match.entity.js';
import { ODDS_PROVIDER_PORT } from '../../../../infrastructure/adapters/outbound/redis/redis-odds.provider.js';
import type { OddsProviderPort } from '../../../../domain/ports/odds-provider.port.js';

export interface MatchRepositoryPort {
  findLiveMatches(): Promise<Match[]>;
  getLiveMatchesWithOdds(): Promise<any[]>;
}

@Injectable()
export class PostgresMatchRepository implements MatchRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ODDS_PROVIDER_PORT) private readonly oddsProvider: OddsProviderPort,
  ) {}

  async findLiveMatches(): Promise<Match[]> {
    const result = await this.dataSource.query(
      `SELECT id, status, home_score, away_score, current_minute, updated_at 
       FROM odds_engine.matches 
       WHERE status = 'LIVE'`,
    );
    return result.map((row: any) => ({
      id: row.id,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      currentMinute: row.current_minute,
      updatedAt: row.updated_at,
    }));
  }

  async getLiveMatchesWithOdds(): Promise<any[]> {
    const liveMatches = await this.findLiveMatches();
    const matchesWithOdds = [];

    for (const match of liveMatches) {
      const odds = await this.oddsProvider.getOddsForMatch(match.id);
      if (odds) {
        matchesWithOdds.push({
          ...match,
          odds,
        });
      }
    }

    return matchesWithOdds;
  }
}

export const MATCH_REPOSITORY_PORT = 'MATCH_REPOSITORY_PORT';