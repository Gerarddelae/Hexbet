import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSettlementSchema1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS settlement');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS settlement.processed_matches (
        match_id UUID PRIMARY KEY,
        settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS settlement.processed_matches');
  }
}
