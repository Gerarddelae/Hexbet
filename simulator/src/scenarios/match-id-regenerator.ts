import { randomUUID } from 'node:crypto';
import type { MatchScenario } from './scenario.types';

export type MatchIdGenerator = () => string;

export function regenerateScenarioMatchIds(
  scenarios: MatchScenario[],
  generateId: MatchIdGenerator = randomUUID,
): MatchScenario[] {
  return scenarios.map((scenario) => ({
    ...scenario,
    matchId: generateId(),
  }));
}
