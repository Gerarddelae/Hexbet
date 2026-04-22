import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RateLimiterPort, RateLimitConfig } from '../../domain/ports';

@Injectable()
export class RedisRateLimiterAdapter implements RateLimiterPort {
  private readonly logger = new Logger(RedisRateLimiterAdapter.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleInit() {
    await this.redis.connect();
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async isAllowed(key: string, config: RateLimitConfig): Promise<boolean> {
    try {
      const current = await this.redis.incr(key);

      if (current === 1) {
        await this.redis.pexpire(key, config.windowMs);
      }

      return current <= config.maxRequests;
    } catch (error: any) {
      this.logger.error(`Rate limit check failed: ${error.message}`);
      return true;
    }
  }

  async getRemaining(key: string): Promise<number> {
    try {
      const current = await this.redis.get(key);
      return current ? Math.max(0, parseInt(current, 10)) : 0;
    } catch (error: any) {
      this.logger.error(`Get remaining failed: ${error.message}`);
      return 0;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error: any) {
      this.logger.error(`Reset failed: ${error.message}`);
    }
  }
}