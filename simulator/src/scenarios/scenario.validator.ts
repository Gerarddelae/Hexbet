import type {
  CardPayload,
  GoalPayload,
  MatchEndPayload,
  MatchResult,
  TeamSide,
} from '@betting-engine/shared-kernel';
import type { MatchScenario, ScenarioEventSpec } from './scenario.types';

export class ScenarioValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Scenario validation failed:\n- ${issues.join('\n- ')}`);
    this.name = 'ScenarioValidationError';
  }
}

type JsonObject = Record<string, unknown>;

export function parseScenario(value: unknown): MatchScenario {
  const issues: string[] = [];

  if (!isObject(value)) {
    throw new ScenarioValidationError(['Root must be a JSON object']);
  }

  const name = asNonEmptyString(value.name, 'name', issues);
  const description = asOptionalString(value.description, 'description', issues);
  const matchId = asNonEmptyString(value.matchId, 'matchId', issues);
  const provider = asOptionalString(value.provider, 'provider', issues);
  const startTimestamp = asOptionalString(value.startTimestamp, 'startTimestamp', issues);

  if (startTimestamp && Number.isNaN(Date.parse(startTimestamp))) {
    issues.push('startTimestamp must be an ISO-8601 date string');
  }

  const eventsRaw = value.events;
  if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) {
    issues.push('events must be a non-empty array');
  }

  const events: ScenarioEventSpec[] = [];
  if (Array.isArray(eventsRaw)) {
    for (let index = 0; index < eventsRaw.length; index += 1) {
      const maybeEvent = eventsRaw[index];
      const parsed = parseEvent(maybeEvent, index, issues);
      if (parsed) {
        events.push(parsed);
      }
    }
  }

  if (events.length > 0) {
    if (events[0].type !== 'MATCH_START') {
      issues.push('The first event must be MATCH_START');
    }

    if (events[events.length - 1].type !== 'MATCH_END') {
      issues.push('The last event must be MATCH_END');
    }
  }

  if (issues.length > 0) {
    throw new ScenarioValidationError(issues);
  }

  return {
    name,
    description,
    matchId,
    provider,
    startTimestamp,
    events,
  };
}

function parseEvent(value: unknown, index: number, issues: string[]): ScenarioEventSpec | null {
  if (!isObject(value)) {
    issues.push(`events[${index}] must be an object`);
    return null;
  }

  const type = asNonEmptyString(value.type, `events[${index}].type`, issues);
  const delay = value.delayFromPreviousMs;

  if (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0) {
    issues.push(`events[${index}].delayFromPreviousMs must be a non-negative number`);
  }

  switch (type) {
    case 'MATCH_START': {
      if (value.payload !== null) {
        issues.push(`events[${index}].payload must be null for MATCH_START`);
      }
      return {
        type,
        delayFromPreviousMs: Number(delay),
        payload: null,
      };
    }

    case 'GOAL': {
      const payload = parseGoalPayload(value.payload, index, issues);
      if (!payload) {
        return null;
      }
      return {
        type,
        delayFromPreviousMs: Number(delay),
        payload,
      };
    }

    case 'YELLOW_CARD':
    case 'RED_CARD': {
      const payload = parseCardPayload(value.payload, index, issues);
      if (!payload) {
        return null;
      }
      return {
        type,
        delayFromPreviousMs: Number(delay),
        payload,
      };
    }

    case 'MATCH_END': {
      const payload = parseMatchEndPayload(value.payload, index, issues);
      if (!payload) {
        return null;
      }
      return {
        type,
        delayFromPreviousMs: Number(delay),
        payload,
      };
    }

    default:
      issues.push(`events[${index}].type is invalid: ${String(type)}`);
      return null;
  }
}

function parseGoalPayload(value: unknown, index: number, issues: string[]): GoalPayload | null {
  if (!isObject(value)) {
    issues.push(`events[${index}].payload must be an object for GOAL`);
    return null;
  }

  const minute = asNumber(value.minute, `events[${index}].payload.minute`, issues);
  const team = asTeamSide(value.team, `events[${index}].payload.team`, issues);
  const homeScore = asNumber(value.homeScore, `events[${index}].payload.homeScore`, issues);
  const awayScore = asNumber(value.awayScore, `events[${index}].payload.awayScore`, issues);

  return { minute, team, homeScore, awayScore };
}

function parseCardPayload(value: unknown, index: number, issues: string[]): CardPayload | null {
  if (!isObject(value)) {
    issues.push(`events[${index}].payload must be an object for card events`);
    return null;
  }

  const minute = asNumber(value.minute, `events[${index}].payload.minute`, issues);
  const team = asTeamSide(value.team, `events[${index}].payload.team`, issues);
  const playerId = asOptionalString(value.playerId, `events[${index}].payload.playerId`, issues);

  return { minute, team, playerId };
}

function parseMatchEndPayload(value: unknown, index: number, issues: string[]): MatchEndPayload | null {
  if (!isObject(value)) {
    issues.push(`events[${index}].payload must be an object for MATCH_END`);
    return null;
  }

  const minute = asNumber(value.minute, `events[${index}].payload.minute`, issues);
  const result = asMatchResult(value.result, `events[${index}].payload.result`, issues);
  const homeScore = asNumber(value.homeScore, `events[${index}].payload.homeScore`, issues);
  const awayScore = asNumber(value.awayScore, `events[${index}].payload.awayScore`, issues);

  return { minute, result, homeScore, awayScore };
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
    return '';
  }

  return value.trim();
}

function asOptionalString(value: unknown, field: string, issues: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    issues.push(`${field} must be a string when present`);
    return undefined;
  }

  return value;
}

function asNumber(value: unknown, field: string, issues: string[]): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(`${field} must be a finite number`);
    return 0;
  }

  return value;
}

function asTeamSide(value: unknown, field: string, issues: string[]): TeamSide {
  if (value === 'HOME' || value === 'AWAY') {
    return value;
  }

  issues.push(`${field} must be HOME or AWAY`);
  return 'HOME';
}

function asMatchResult(value: unknown, field: string, issues: string[]): MatchResult {
  if (value === 'HOME_WIN' || value === 'DRAW' || value === 'AWAY_WIN') {
    return value;
  }

  issues.push(`${field} must be HOME_WIN, DRAW or AWAY_WIN`);
  return 'DRAW';
}