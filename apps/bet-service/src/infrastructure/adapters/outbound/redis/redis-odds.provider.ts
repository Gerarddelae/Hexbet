import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { OddsProviderPort } from '../../../../domain/ports/odds-provider.port.js';
import type { LiveMatchWithOdds } from '../../../../domain/entities/match.entity.js';

@Injectable()
export class RedisOddsProvider implements OddsProviderPort {
  private readonly logger = new Logger(RedisOddsProvider.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  }

  async getOddsForMatch(matchId: string): Promise<LiveMatchWithOdds['odds'] | null> {
    const data = await this.redis.get(`odds:${matchId}`);
    if (!data) return null;
    return JSON.parse(data);
  }
}

export const ODDS_PROVIDER_PORT = 'ODDS_PROVIDER_PORT';