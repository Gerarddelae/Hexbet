import test from 'node:test';
import { strict as assert } from 'assert';
import { MatchEvent } from '@betting-engine/shared-kernel';
import {
  MatchRepositoryPort,
  MatchTransactionPort,
} from '../../domain/ports/match-repository.port';
import {
  MatchState,
  ProcessedMatchEventRef,
} from '../../domain/models/match-state.model';
import {
  ProcessMatchEventUseCase,
} from './process-match-event.use-case';

class InMemoryMatchRepository implements MatchRepositoryPort {
  public readonly matches = new Map<string, MatchState>();
  private readonly processedEvents = new Set<string>();

  async withTransaction<T>(work: (tx: MatchTransactionPort) => Promise<T>): Promise<T> {
    const tx: MatchTransactionPort = {
      markEventAsProcessed: async (eventRef: ProcessedMatchEventRef): Promise<boolean> => {
        const key = `${eventRef.provider}:${eventRef.providerEventId}`;

        if (this.processedEvents.has(key)) {
          return false;
        }

        this.processedEvents.add(key);
        return true;
      },
      findMatchById: async (matchId: string): Promise<MatchState | null> => {
        return this.matches.get(matchId) ?? null;
      },
      saveMatch: async (match: MatchState): Promise<void> => {
        this.matches.set(match.id, match);
      },
    };

    return work(tx);
  }
}

function baseEvent(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'event-1',
    matchId: 'e5d4e815-9d2c-4f0c-9d09-daa4624bc001',
    timestamp: '2026-04-18T00:00:00.000Z',
    provider: 'simulator',
    providerEventId: 'sim-1',
    type: 'MATCH_START',
    payload: null,
    ...overrides,
  } as MatchEvent;
}

test('processes MATCH_START and creates a live match', async () => {
  const repository = new InMemoryMatchRepository();
  const useCase = new ProcessMatchEventUseCase(repository);

  const result = await useCase.execute(baseEvent({ type: 'MATCH_START', payload: null }));

  const saved = repository.matches.get('e5d4e815-9d2c-4f0c-9d09-daa4624bc001');

  assert.equal(result.status, 'processed');
  assert.ok(result.matchState);
  if (!saved) throw new Error('Expected match to be saved');
  assert.equal(saved.status, 'LIVE');
  assert.equal(saved.homeScore, 0);
  assert.equal(saved.awayScore, 0);
  assert.equal(saved.currentMinute, 0);
});

test('processes GOAL and updates score and minute', async () => {
  const repository = new InMemoryMatchRepository();
  const useCase = new ProcessMatchEventUseCase(repository);

  await useCase.execute(baseEvent({ type: 'MATCH_START', payload: null }));

  const result = await useCase.execute(
    baseEvent({
      id: 'event-2',
      providerEventId: 'sim-2',
      type: 'GOAL',
      payload: {
        minute: 23,
        team: 'HOME',
        homeScore: 1,
        awayScore: 0,
      },
    }),
  );

  const saved = repository.matches.get('e5d4e815-9d2c-4f0c-9d09-daa4624bc001');

  assert.equal(result.status, 'processed');
  assert.ok(result.matchState);
  if (!saved) throw new Error('Expected match to be saved');
  assert.equal(saved.status, 'LIVE');
  assert.equal(saved.homeScore, 1);
  assert.equal(saved.awayScore, 0);
  assert.equal(saved.currentMinute, 23);
});

test('marks duplicated event as duplicate and does not change the match state', async () => {
  const repository = new InMemoryMatchRepository();
  const useCase = new ProcessMatchEventUseCase(repository);

  await useCase.execute(baseEvent({ type: 'MATCH_START', payload: null }));

  const firstResult = await useCase.execute(
    baseEvent({
      id: 'event-3',
      providerEventId: 'sim-3',
      type: 'GOAL',
      payload: {
        minute: 10,
        team: 'HOME',
        homeScore: 1,
        awayScore: 0,
      },
    }),
  );

  const duplicateResult = await useCase.execute(
    baseEvent({
      id: 'event-4',
      providerEventId: 'sim-3',
      type: 'GOAL',
      payload: {
        minute: 11,
        team: 'AWAY',
        homeScore: 1,
        awayScore: 1,
      },
    }),
  );

  const saved = repository.matches.get('e5d4e815-9d2c-4f0c-9d09-daa4624bc001');

  assert.equal(firstResult.status, 'processed');
  assert.equal(duplicateResult.status, 'duplicate');
  assert.equal(duplicateResult.matchState, null);
  if (!saved) throw new Error('Expected match to be saved');
  assert.equal(saved.homeScore, 1);
  assert.equal(saved.awayScore, 0);
  assert.equal(saved.currentMinute, 10);
});

test('processes MATCH_END and updates final state', async () => {
  const repository = new InMemoryMatchRepository();
  const useCase = new ProcessMatchEventUseCase(repository);

  await useCase.execute(baseEvent({ type: 'MATCH_START', payload: null }));

  const result = await useCase.execute(
    baseEvent({
      id: 'event-5',
      providerEventId: 'sim-5',
      type: 'MATCH_END',
      payload: {
        minute: 90,
        result: 'HOME_WIN',
        homeScore: 2,
        awayScore: 1,
      },
    }),
  );

  const saved = repository.matches.get('e5d4e815-9d2c-4f0c-9d09-daa4624bc001');

  assert.equal(result.status, 'processed');
  assert.ok(result.matchState);
  if (!saved) throw new Error('Expected match to be saved');
  assert.equal(saved.status, 'FINISHED');
  assert.equal(saved.homeScore, 2);
  assert.equal(saved.awayScore, 1);
  assert.equal(saved.currentMinute, 90);
});
