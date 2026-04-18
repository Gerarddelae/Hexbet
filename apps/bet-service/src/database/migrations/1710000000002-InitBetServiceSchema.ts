import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitBetServiceSchema1710000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS bet_service');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bet_service.users (
        id UUID PRIMARY KEY,
        balance_cents BIGINT NOT NULL DEFAULT 100000,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bet_service.bets (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        match_id UUID NOT NULL,
        selection VARCHAR(8) NOT NULL,
        accepted_odds NUMERIC(8,3) NOT NULL,
        stake_cents BIGINT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bet_service_bets_user_id
      ON bet_service.bets (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bet_service_bets_match_id
      ON bet_service.bets (match_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS bet_service.bets');
    await queryRunner.query('DROP TABLE IF EXISTS bet_service.users');
  }
}
