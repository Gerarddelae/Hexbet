import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UserRepositoryPort } from '../../../../domain/ports/user-repository.port';

@Injectable()
export class PostgresUserRepository implements UserRepositoryPort {
  private readonly logger = new Logger(PostgresUserRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async findById(id: string): Promise<{ id: string; balanceCents: number; createdAt: Date } | null> {
    const result = await this.dataSource.query(
      'SELECT id, balance_cents, created_at FROM bet_service.users WHERE id = $1',
      [id],
    );
    if (result.length === 0) return null;
    const row = result[0];
    return {
      id: row.id,
      balanceCents: Number(row.balance_cents),
      createdAt: row.created_at,
    };
  }

  async save(user: { id: string; balanceCents: number }): Promise<void> {
    await this.dataSource.query(
      'INSERT INTO bet_service.users (id, balance_cents) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [user.id, user.balanceCents],
    );
  }

  async deductBalance(userId: string, amountCents: number): Promise<boolean> {
    const result = await this.dataSource.query(
      `UPDATE bet_service.users 
       SET balance_cents = balance_cents - $1 
       WHERE id = $2 AND balance_cents >= $1 
       RETURNING id`,
      [amountCents, userId],
    );
    return result.length > 0;
  }
}

export const USER_REPOSITORY_PORT = 'USER_REPOSITORY_PORT';