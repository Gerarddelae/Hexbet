export type MatchEventType =
  | 'MATCH_START'
  | 'GOAL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'MATCH_END';

export type TeamSide = 'HOME' | 'AWAY';

export interface GoalPayload {
  minute: number;
  team: TeamSide;
  homeScore: number;
  awayScore: number;
}

export interface CardPayload {
  minute: number;
  team: TeamSide;
  playerId?: string;
}

export type MatchResult = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';

export interface MatchEndPayload {
  minute: number;
  result: MatchResult;
  homeScore: number;
  awayScore: number;
}

export interface BaseMatchEvent {
  id: string;
  matchId: string;
  timestamp: string;
  provider: string;
  providerEventId: string;
}

export interface MatchStartEvent extends BaseMatchEvent {
  type: 'MATCH_START';
  payload: null;
}

export interface GoalEvent extends BaseMatchEvent {
  type: 'GOAL';
  payload: GoalPayload;
}

export interface YellowCardEvent extends BaseMatchEvent {
  type: 'YELLOW_CARD';
  payload: CardPayload;
}

export interface RedCardEvent extends BaseMatchEvent {
  type: 'RED_CARD';
  payload: CardPayload;
}

export interface MatchEndEvent extends BaseMatchEvent {
  type: 'MATCH_END';
  payload: MatchEndPayload;
}

export type MatchEvent =
  | MatchStartEvent
  | GoalEvent
  | YellowCardEvent
  | RedCardEvent
  | MatchEndEvent;
