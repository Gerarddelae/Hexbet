export interface UserRepositoryPort {
  findById(id: string): Promise<{ id: string; balanceCents: number; createdAt: Date } | null>;
  save(user: { id: string; balanceCents: number }): Promise<void>;
  deductBalance(userId: string, amountCents: number): Promise<boolean>;
}