import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export const BET_SERVICE_HTTP_CLIENT = 'BET_SERVICE_HTTP_CLIENT';

export interface BetServiceBet {
  id: string;
  userId: string;
  matchId: string;
  selection: 'HOME' | 'DRAW' | 'AWAY';
  acceptedOdds: number;
  stakeCents: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID';
  payoutCents?: number;
  createdAt: string;
}

export interface SettleBetDto {
  result: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';
}

@Injectable()
export class BetServiceHttpClient {
  private readonly logger = new Logger(BetServiceHttpClient.name);
  private readonly baseUrl: string;
  private readonly client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.BET_SERVICE_URL ?? 'http://localhost:3002';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  async getBetsForMatch(matchId: string, status: string): Promise<BetServiceBet[]> {
    try {
      const response = await this.client.get<BetServiceBet[]>('/internal/bets', {
        params: { matchId, status },
      });
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to fetch bets for match ${matchId}: ${message}`);
      return [];
    }
  }

  async settleBet(betId: string, result: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'): Promise<boolean> {
    try {
      const dto: SettleBetDto = { result };

      this.logger.log(`Sending settle request to ${this.baseUrl}/internal/bets/${betId}/settle with body: ${JSON.stringify(dto)}`);

      await this.client.patch(`/internal/bets/${betId}/settle`, dto, {
        headers: { 'Content-Type': 'application/json' },
      });

      this.logger.log(`Settled bet ${betId} with result ${result}`);
      return true;
    } catch (error) {
      const axiosError = error as { response?: { data?: unknown; status?: number }; message?: string };
      this.logger.error(`Failed to settle bet ${betId}: ${axiosError?.message}`);
      this.logger.error(`Response data: ${JSON.stringify(axiosError?.response?.data)}`);
      this.logger.error(`Response status: ${axiosError?.response?.status}`);
      return false;
    }
  }
}