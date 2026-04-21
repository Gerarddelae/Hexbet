import test from 'node:test';
import { strict as assert } from 'assert';
import { MatchEvent } from '@betting-engine/shared-kernel';
import { OddsCalculatorService } from './odds-calculator.service';
import { MatchState } from '../models/match-state.model';

const calculator = new OddsCalculatorService();

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'event-1',
    matchId: 'match-1',
    provider: 'simulator',
    providerEventId: 'sim-1',
    timestamp: '2026-04-19T00:00:00.000Z',
    type: 'MATCH_START',
    payload: null,
    ...overrides,
  } as MatchEvent;
}

function state(overrides: Partial<MatchState>): MatchState {
  return {
    id: 'match-1',
    status: 'LIVE',
    homeScore: 0,
    awayScore: 0,
    currentMinute: 0,
    ...overrides,
  };
}

test('returns base-like odds at match start', () => {
  const odds = calculator.calculate(state({ status: 'LIVE', currentMinute: 0 }), event({ type: 'MATCH_START', payload: null }));

  assert.ok(odds.home < odds.away);
  assert.ok(odds.draw > 2);
  assert.ok(odds.home > 1);
});

test('decreases home odd when home scores a goal', () => {
  const before = calculator.calculate(
    state({ homeScore: 0, awayScore: 0, currentMinute: 30 }),
    event({ type: 'MATCH_START', payload: null }),
  );
  const after = calculator.calculate(
    state({ homeScore: 1, awayScore: 0, currentMinute: 31 }),
    event({
      type: 'GOAL',
      payload: { minute: 31, team: 'HOME', homeScore: 1, awayScore: 0 },
    }),
  );

  assert.ok(after.home < before.home);
  assert.ok(after.away > before.away);
});

test('decreases away odd when away scores a goal', () => {
  const before = calculator.calculate(
    state({ homeScore: 0, awayScore: 0, currentMinute: 30 }),
    event({ type: 'MATCH_START', payload: null }),
  );
  const after = calculator.calculate(
    state({ homeScore: 0, awayScore: 1, currentMinute: 31 }),
    event({
      type: 'GOAL',
      payload: { minute: 31, team: 'AWAY', homeScore: 0, awayScore: 1 },
    }),
  );

  assert.ok(after.away < before.away);
  assert.ok(after.home > before.home);
});

test('penalizes team receiving a red card', () => {
  const neutral = calculator.calculate(
    state({ homeScore: 0, awayScore: 0, currentMinute: 55 }),
    event({ type: 'MATCH_START', payload: null }),
  );
  const homeRed = calculator.calculate(
    state({ homeScore: 0, awayScore: 0, currentMinute: 55 }),
    event({ type: 'RED_CARD', payload: { minute: 55, team: 'HOME' } }),
  );

  assert.ok(homeRed.home > neutral.home);
  assert.ok(homeRed.away < neutral.away);
});

test('returns near-closed market odds when match is finished', () => {
  const odds = calculator.calculate(
    state({ status: 'FINISHED', homeScore: 2, awayScore: 1, currentMinute: 90 }),
    event({
      type: 'MATCH_END',
      payload: { minute: 90, result: 'HOME_WIN', homeScore: 2, awayScore: 1 },
    }),
  );

  assert.ok(odds.home < 1.2);
  assert.ok(odds.away > 10);
  assert.ok(odds.draw > 10);
});
