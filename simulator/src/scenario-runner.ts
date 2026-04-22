import { mapScenarioToMatchEvents } from './mapper/scenario-event.mapper';
import type { MatchScenario } from './scenarios/scenario.types';
import { KafkaProducerService } from './infrastructure/kafka-producer.service';

export interface RunScenarioInput {
  scenario: MatchScenario;
  speedFactor: number;
}

export interface RunScenarioResult {
  matchId: string;
  eventsPublished: number;
  durationMs: number;
}

export class ScenarioRunner {
  constructor(private readonly producer: KafkaProducerService) {}

  async run(input: RunScenarioInput): Promise<RunScenarioResult> {
    const startedAt = Date.now();
    const events = mapScenarioToMatchEvents(input.scenario);

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const delayMs = input.scenario.events[index].delayFromPreviousMs;
      const effectiveDelayMs = Math.max(0, Math.round(delayMs / input.speedFactor));

      if (effectiveDelayMs > 0) {
        await sleep(effectiveDelayMs);
      }

      await this.producer.publishMatchEvent(event);

      console.log(
        `[${index + 1}/${events.length}] published ${event.type} matchId=${event.matchId} delayMs=${effectiveDelayMs}`,
      );
    }

    return {
      matchId: input.scenario.matchId,
      eventsPublished: events.length,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}