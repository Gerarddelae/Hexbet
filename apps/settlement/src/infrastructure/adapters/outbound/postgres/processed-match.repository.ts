import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class ProcessedMatchRepository {
  private readonly logger = new Logger(ProcessedMatchRepository.name);
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5432,
        user: process.env.POSTGRES_USER_SERVICE ?? process.env.POSTGRES_USER ?? 'postgres',
        password: process.env.POSTGRES_PASSWORD_SERVICE ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
        database: process.env.POSTGRES_DB_SERVICE ?? process.env.POSTGRES_DB ?? 'betting_engine',
      });
    }
    return this.pool;
  }

  async exists(matchId: string): Promise<boolean> {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT 1 FROM settlement.processed_matches WHERE match_id = $1',
      [matchId],
    );
    return result.rows.length > 0;
  }

  async save(matchId: string): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      'INSERT INTO settlement.processed_matches (match_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [matchId],
    );
    this.logger.log(`Marked match ${matchId} as processed`);
  }
}