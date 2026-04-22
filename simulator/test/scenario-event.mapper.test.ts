import assert from 'node:assert/strict';
import test from 'node:test';
import { mapScenarioToMatchEvents } from '../src/mapper/scenario-event.mapper';
import type { MatchScenario } from '../src/scenarios/scenario.types';

test('mapScenarioToMatchEvents maps canonical events and timestamps', () => {
  const scenario: MatchScenario = {
    name: 'unit-mapper',
    matchId: '33333333-3333-4333-8333-333333333333',
    provider: 'simulator',
    startTimestamp: '2026-01-01T00:00:00.000Z',
    events: [
      {
        type: 'MATCH_START',
        delayFromPreviousMs: 0,
        payload: null,
      },
      {
        type: 'GOAL',
        delayFromPreviousMs: 60000,
        payload: {
          minute: 1,
          team: 'HOME',
          homeScore: 1,
          awayScore: 0,
        },
      },
      {
        type: 'MATCH_END',
        delayFromPreviousMs: 60000,
        payload: {
          minute: 2,
          result: 'HOME_WIN',
          homeScore: 1,
          awayScore: 0,
        },
      },
    ],
  };

  const mapped = mapScenarioToMatchEvents(scenario);

  assert.equal(mapped.length, 3);
  assert.equal(mapped[0].type, 'MATCH_START');
  assert.equal(mapped[1].type, 'GOAL');
  assert.equal(mapped[2].type, 'MATCH_END');
  assert.equal(mapped[0].provider, 'simulator');
  assert.equal(mapped[0].matchId, scenario.matchId);
  assert.equal(mapped[1].timestamp, '2026-01-01T00:01:00.000Z');
  assert.equal(mapped[2].timestamp, '2026-01-01T00:02:00.000Z');
});