import { MatchEvent } from '../events/match.events';

export interface IMatchDataProvider {
  getMatchEvents(matchId: string): Promise<MatchEvent[]>;
}
