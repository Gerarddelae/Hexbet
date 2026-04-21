import test from 'node:test';
import { strict as assert } from 'assert';
import { MatchEvent, OddsSnapshot, OddsUpdatedEvent } from '@betting-engine/shared-kernel';
import { MatchState } from '../../domain/models/match-state.model';
import { OddsPublisherPort } from '../../domain/ports/odds-publisher.port';
import { OddsCalculatorService } from '../../domain/services/odds-calculator.service';
import { RecalculateOddsUseCase } from './recalculate-odds.use-case';

class FakeOddsPublisher implements OddsPublisherPort {
  public redisCalls = 0;
  public kafkaCalls = 0;
  public publishedRedis: Array<{ matchId: string; odds: OddsSnapshot }> = [];
  public publishedKafka: OddsUpdatedEvent[] = [];
  public failRedis = false;
  public failKafka = false;

  async publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void> {
    this.redisCalls += 1;

    if (this.failRedis) {
      throw new Error('redis down');
    }

    this.publishedRedis.push({ matchId, odds });
  }

  async publishToKafka(event: OddsUpdatedEvent): Promise<void> {
    this.kafkaCalls += 1;

    if (this.failKafka) {
      throw new Error('kafka down');
    }

    this.publishedKafka.push(event);
  }
}

function baseEvent(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'evt-1',
    matchId: 'match-1',
    provider: 'simulator',
    providerEventId: 'sim-1',
    timestamp: '2026-04-19T00:00:00.000Z',
    type: 'MATCH_START',
    payload: null,
    ...overrides,
  } as MatchEvent;
}

function baseState(overrides: Partial<MatchState>): MatchState {
  return {
    id: 'match-1',
    status: 'LIVE',
    homeScore: 0,
    awayScore: 0,
    currentMinute: 10,
    ...overrides,
  };
}

test('publishes to Redis and Kafka when both destinations are available', async () => {
  const publisher = new FakeOddsPublisher();
  const useCase = new RecalculateOddsUseCase(
    new OddsCalculatorService(),
    publisher,
  );

  const result = await useCase.execute({
    event: baseEvent({ type: 'MATCH_START', payload: null }),
    matchState: baseState({}),
  });

  assert.equal(result.status, 'published');
  assert.equal(result.publication.redis, 'ok');
  assert.equal(result.publication.kafka, 'ok');
  assert.equal(publisher.publishedRedis.length, 1);
  assert.equal(publisher.publishedKafka.length, 1);
  assert.equal(publisher.publishedKafka[0]?.triggeredByEventId, 'evt-1');
});

test('returns partial failure when Redis publication fails and Kafka succeeds', async () => {
  const publisher = new FakeOddsPublisher();
  publisher.failRedis = true;

  const useCase = new RecalculateOddsUseCase(
    new OddsCalculatorService(),
    publisher,
  );

  const result = await useCase.execute({
    event: baseEvent({
      id: 'evt-2',
      providerEventId: 'sim-2',
      type: 'GOAL',
      payload: {
        minute: 20,
        team: 'HOME',
        homeScore: 1,
        awayScore: 0,
      },
    }),
    matchState: baseState({ homeScore: 1, awayScore: 0, currentMinute: 20 }),
  });

  assert.equal(result.status, 'partial_failure');
  assert.equal(result.publication.redis, 'failed');
  assert.equal(result.publication.kafka, 'ok');
  assert.equal(publisher.redisCalls, 3);
  assert.equal(publisher.kafkaCalls, 1);
});

test('returns failed when Redis and Kafka publications fail', async () => {
  const publisher = new FakeOddsPublisher();
  publisher.failRedis = true;
  publisher.failKafka = true;

  const useCase = new RecalculateOddsUseCase(
    new OddsCalculatorService(),
    publisher,
  );

  const result = await useCase.execute({
    event: baseEvent({
      id: 'evt-3',
      providerEventId: 'sim-3',
      type: 'RED_CARD',
      payload: {
        minute: 44,
        team: 'AWAY',
      },
    }),
    matchState: baseState({ currentMinute: 44 }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.publication.redis, 'failed');
  assert.equal(result.publication.kafka, 'failed');
  assert.equal(publisher.redisCalls, 3);
  assert.equal(publisher.kafkaCalls, 3);
});
