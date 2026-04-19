import { MatchState, ProcessedMatchEventRef } from '../models/match-state.model';

export const MATCH_REPOSITORY_PORT = Symbol('MATCH_REPOSITORY_PORT');

export interface MatchTransactionPort {
  markEventAsProcessed(eventRef: ProcessedMatchEventRef): Promise<boolean>;
  findMatchById(matchId: string): Promise<MatchState | null>;
  saveMatch(match: MatchState): Promise<void>;
}

export interface MatchRepositoryPort {
  withTransaction<T>(work: (tx: MatchTransactionPort) => Promise<T>): Promise<T>;
}
