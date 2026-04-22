export interface User {
  id: string;
  balanceCents: number;
  createdAt: Date;
}

export interface CreateUserParams {
  id: string;
  balanceCents?: number;
}