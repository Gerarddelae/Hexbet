import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitOddsEngineSchema1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS odds_engine');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS odds_engine.matches (
        id UUID PRIMARY KEY,
        status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
        home_score INTEGER NOT NULL DEFAULT 0,
        away_score INTEGER NOT NULL DEFAULT 0,
        current_minute INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS odds_engine.match_event_log (
        provider VARCHAR(128) NOT NULL,
        provider_event_id VARCHAR(128) NOT NULL,
        match_id UUID NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (provider, provider_event_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS odds_engine.match_event_log');
    await queryRunner.query('DROP TABLE IF EXISTS odds_engine.matches');
  }
}
