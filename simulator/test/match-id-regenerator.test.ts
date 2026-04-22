import assert from 'node:assert/strict';
import test from 'node:test';
import type { MatchScenario } from '../src/scenarios/scenario.types';
import { regenerateScenarioMatchIds } from '../src/scenarios/match-id-regenerator';

test('regenerateScenarioMatchIds assigns new ids without mutating input scenarios', () => {
  const scenarios: MatchScenario[] = [
    {
      name: 's1',
      matchId: '11111111-1111-4111-8111-111111111111',
      provider: 'simulator',
      events: [
        {
          type: 'MATCH_START',
          delayFromPreviousMs: 0,
          payload: null,
        },
        {
          type: 'MATCH_END',
          delayFromPreviousMs: 1000,
          payload: {
            minute: 90,
            result: 'DRAW',
            homeScore: 0,
            awayScore: 0,
          },
        },
      ],
    },
    {
      name: 's2',
      matchId: '22222222-2222-4222-8222-222222222222',
      provider: 'simulator',
      events: [
        {
          type: 'MATCH_START',
          delayFromPreviousMs: 0,
          payload: null,
        },
        {
          type: 'MATCH_END',
          delayFromPreviousMs: 1000,
          payload: {
            minute: 90,
            result: 'DRAW',
            homeScore: 0,
            awayScore: 0,
          },
        },
      ],
    },
  ];

  const queue = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  const remapped = regenerateScenarioMatchIds(scenarios, () => {
    const next = queue.shift();
    assert.ok(next);
    return next;
  });

  assert.equal(remapped.length, 2);
  assert.equal(remapped[0].matchId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(remapped[1].matchId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

  assert.equal(scenarios[0].matchId, '11111111-1111-4111-8111-111111111111');
  assert.equal(scenarios[1].matchId, '22222222-2222-4222-8222-222222222222');
  assert.notEqual(remapped[0], scenarios[0]);
  assert.notEqual(remapped[1], scenarios[1]);
});
