import { randomUUID } from 'node:crypto';
import type {
  MatchEndEvent,
  MatchEvent,
  MatchStartEvent,
  GoalEvent,
  RedCardEvent,
  YellowCardEvent,
} from '@betting-engine/shared-kernel';
import type { MatchScenario } from '../scenarios/scenario.types';

export function mapScenarioToMatchEvents(scenario: MatchScenario): MatchEvent[] {
  const provider = scenario.provider ?? 'simulator';
  const baseTimestampMs = scenario.startTimestamp
    ? Date.parse(scenario.startTimestamp)
    : Date.now();

  let elapsedMs = 0;

  return scenario.events.map((spec) => {
    elapsedMs += spec.delayFromPreviousMs;

    const id = randomUUID();
    const baseEvent = {
      id,
      matchId: scenario.matchId,
      provider,
      providerEventId: `${provider}-${id}`,
      timestamp: new Date(baseTimestampMs + elapsedMs).toISOString(),
    };

    switch (spec.type) {
      case 'MATCH_START':
        return {
          ...baseEvent,
          type: 'MATCH_START',
          payload: null,
        } satisfies MatchStartEvent;

      case 'GOAL':
        return {
          ...baseEvent,
          type: 'GOAL',
          payload: spec.payload,
        } satisfies GoalEvent;

      case 'YELLOW_CARD':
        return {
          ...baseEvent,
          type: 'YELLOW_CARD',
          payload: spec.payload,
        } satisfies YellowCardEvent;

      case 'RED_CARD':
        return {
          ...baseEvent,
          type: 'RED_CARD',
          payload: spec.payload,
        } satisfies RedCardEvent;

      case 'MATCH_END':
        return {
          ...baseEvent,
          type: 'MATCH_END',
          payload: spec.payload,
        } satisfies MatchEndEvent;
    }
  });
}