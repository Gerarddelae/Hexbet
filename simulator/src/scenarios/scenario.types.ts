import type {
  CardPayload,
  GoalPayload,
  MatchEndPayload,
  MatchEventType,
} from '@betting-engine/shared-kernel';

export interface ScenarioBaseEvent {
  type: MatchEventType;
  delayFromPreviousMs: number;
}

export interface ScenarioMatchStartEvent extends ScenarioBaseEvent {
  type: 'MATCH_START';
  payload: null;
}

export interface ScenarioGoalEvent extends ScenarioBaseEvent {
  type: 'GOAL';
  payload: GoalPayload;
}

export interface ScenarioYellowCardEvent extends ScenarioBaseEvent {
  type: 'YELLOW_CARD';
  payload: CardPayload;
}

export interface ScenarioRedCardEvent extends ScenarioBaseEvent {
  type: 'RED_CARD';
  payload: CardPayload;
}

export interface ScenarioMatchEndEvent extends ScenarioBaseEvent {
  type: 'MATCH_END';
  payload: MatchEndPayload;
}

export type ScenarioEventSpec =
  | ScenarioMatchStartEvent
  | ScenarioGoalEvent
  | ScenarioYellowCardEvent
  | ScenarioRedCardEvent
  | ScenarioMatchEndEvent;

export interface MatchScenario {
  name: string;
  description?: string;
  matchId: string;
  provider?: string;
  startTimestamp?: string;
  events: ScenarioEventSpec[];
}