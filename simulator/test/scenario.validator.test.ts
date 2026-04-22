import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScenario, ScenarioValidationError } from '../src/scenarios/scenario.validator';

test('parseScenario rejects scenario when last event is not MATCH_END', () => {
  const invalidScenario = {
    name: 'invalid-order',
    matchId: '44444444-4444-4444-8444-444444444444',
    events: [
      {
        type: 'MATCH_START',
        delayFromPreviousMs: 0,
        payload: null,
      },
      {
        type: 'GOAL',
        delayFromPreviousMs: 1000,
        payload: {
          minute: 1,
          team: 'HOME',
          homeScore: 1,
          awayScore: 0,
        },
      },
    ],
  };

  assert.throws(() => parseScenario(invalidScenario), ScenarioValidationError);
});