import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Bet, BetStatus } from '../../../../domain/entities/bet.entity.js';
import type { BetRepositoryPort } from '../../../../domain/ports/bet-repository.port.js';

@Injectable()
export class PostgresBetRepository implements BetRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async save(bet: Omit<Bet, 'createdAt'>): Promise<Bet> {
    const result = await this.dataSource.query(
      `INSERT INTO bet_service.bets (id, user_id, match_id, selection, accepted_odds, stake_cents, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, match_id, selection, accepted_odds, stake_cents, status, created_at`,
      [bet.id, bet.userId, bet.matchId, bet.selection, bet.acceptedOdds, bet.stakeCents, bet.status],
    );
    const row = result[0];
    return {
      id: row.id,
      userId: row.user_id,
      matchId: row.match_id,
      selection: row.selection,
      acceptedOdds: Number(row.accepted_odds),
      stakeCents: Number(row.stake_cents),
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async findById(id: string): Promise<Bet | null> {
    const result = await this.dataSource.query(
      'SELECT * FROM bet_service.bets WHERE id = $1',
      [id],
    );
    if (result.length === 0) return null;
    const row = result[0];
    return this.mapRowToBet(row);
  }

  async findByUser(userId: string): Promise<Bet[]> {
    const result = await this.dataSource.query(
      'SELECT * FROM bet_service.bets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.map((row: any) => this.mapRowToBet(row));
  }

  async updateStatus(betId: string, status: BetStatus): Promise<void> {
    await this.dataSource.query(
      'UPDATE bet_service.bets SET status = $1 WHERE id = $2',
      [status, betId],
    );
  }

  private mapRowToBet(row: any): Bet {
    return {
      id: row.id,
      userId: row.user_id,
      matchId: row.match_id,
      selection: row.selection,
      acceptedOdds: Number(row.accepted_odds),
      stakeCents: Number(row.stake_cents),
      status: row.status,
      createdAt: row.created_at,
    };
  }
}

export const BET_REPOSITORY_PORT = 'BET_REPOSITORY_PORT';