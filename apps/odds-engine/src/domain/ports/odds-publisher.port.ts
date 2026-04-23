import { OddsSnapshot, OddsUpdatedEvent } from '@betting-engine/shared-kernel';

export const ODDS_PUBLISHER_PORT = Symbol('ODDS_PUBLISHER_PORT');

export interface OddsPublisherPort {
	publishToRedis(matchId: string, odds: OddsSnapshot): Promise<void>;
	publishToKafka(event: OddsUpdatedEvent): Promise<void>;
	deleteOdds(matchId: string): Promise<void>;
}
