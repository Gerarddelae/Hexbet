import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayoutCentsColumn1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bet_service.bets 
      ADD COLUMN IF NOT EXISTS payout_cents BIGINT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bet_service.bets 
      DROP COLUMN IF EXISTS payout_cents
    `);
  }
}