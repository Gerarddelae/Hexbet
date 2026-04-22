import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryRunner } from "typeorm";
import {
  MatchRepositoryPort,
  MatchTransactionPort,
} from "../../../../domain/ports/match-repository.port";
import {
  MatchState,
  ProcessedMatchEventRef,
} from "../../../../domain/models/match-state.model";

@Injectable()
export class PostgresMatchRepository implements MatchRepositoryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async withTransaction<T>(
    work: (tx: MatchTransactionPort) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const txPort = this.buildTransactionPort(queryRunner);
      const result = await work(txPort);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private buildTransactionPort(queryRunner: QueryRunner): MatchTransactionPort {
    return {
      markEventAsProcessed: async (eventRef) =>
        this.markEventAsProcessed(queryRunner, eventRef),
      findMatchById: async (matchId) =>
        this.findMatchById(queryRunner, matchId),
      saveMatch: async (match) => this.saveMatch(queryRunner, match),
    };
  }

  private async markEventAsProcessed(
    queryRunner: QueryRunner,
    eventRef: ProcessedMatchEventRef,
  ): Promise<boolean> {
    const rows: Array<{ provider: string }> = await queryRunner.manager.query(
      `
        WITH m AS (
          SELECT status FROM odds_engine.matches WHERE id = $3 FOR UPDATE
        )
        INSERT INTO odds_engine.match_event_log (
          provider,
          provider_event_id,
          match_id
        )
        SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM m WHERE status = 'FINISHED')
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING provider
      `,
      [eventRef.provider, eventRef.providerEventId, eventRef.matchId],
    );

    return rows.length > 0;
  }

  private async findMatchById(
    queryRunner: QueryRunner,
    matchId: string,
  ): Promise<MatchState | null> {
    const rows: Array<{
      id: string;
      status: MatchState["status"];
      homeScore: number;
      awayScore: number;
      currentMinute: number;
    }> = await queryRunner.manager.query(
      `
        SELECT
          id,
          status,
          home_score AS "homeScore",
          away_score AS "awayScore",
          current_minute AS "currentMinute"
        FROM odds_engine.matches
        WHERE id = $1
        LIMIT 1
      `,
      [matchId],
    );

    return rows[0] ?? null;
  }

  private async saveMatch(
    queryRunner: QueryRunner,
    match: MatchState,
  ): Promise<void> {
    await queryRunner.manager.query(
      `
        INSERT INTO odds_engine.matches (
          id,
          status,
          home_score,
          away_score,
          current_minute,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          current_minute = EXCLUDED.current_minute,
          updated_at = NOW()
      `,
      [
        match.id,
        match.status,
        match.homeScore,
        match.awayScore,
        match.currentMinute,
      ],
    );
  }
}
