import { KafkaProducerService } from './infrastructure/kafka-producer.service';
import { ScenarioRunner } from './scenario-runner';
import { listScenarios, loadScenarios } from './scenarios/scenario.loader';
import { regenerateScenarioMatchIds } from './scenarios/match-id-regenerator';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'list') {
    await handleList();
    return;
  }

  if (command === 'run') {
    await handleRun(args.slice(1));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function handleList(): Promise<void> {
  const scenarios = await listScenarios();

  if (scenarios.length === 0) {
    console.log('No scenarios found in ./scenarios');
    return;
  }

  console.log('Available scenarios:');
  for (const scenario of scenarios) {
    console.log(`- ${scenario}`);
  }
}

async function handleRun(args: string[]): Promise<void> {
  const scenarioInput = readOption(args, ['--scenario', '-s']) ?? args[0];
  const speedInput = readOption(args, ['--speed', '-x']) ?? '1x';
  const freshMatchIds = hasFlag(args, ['--fresh-match-ids']);

  if (!scenarioInput) {
    throw new Error('Missing --scenario value. Example: run --scenario normal-match --speed 60x');
  }

  const speedFactor = parseSpeedFactor(speedInput);
  const loadedScenarios = await loadScenarios(scenarioInput);
  const scenarios = freshMatchIds ? regenerateScenarioMatchIds(loadedScenarios) : loadedScenarios;

  const producer = new KafkaProducerService();
  const runner = new ScenarioRunner(producer);

  try {
    console.log(
      `Running ${scenarios.length} scenario(s) speed=${speedFactor}x freshMatchIds=${freshMatchIds}`,
    );

    if (freshMatchIds) {
      for (let index = 0; index < loadedScenarios.length; index += 1) {
        const before = loadedScenarios[index];
        const after = scenarios[index];

        console.log(
          `- remapped scenario=${before.name} matchId old=${before.matchId} new=${after.matchId}`,
        );
      }
    }

    const promises = scenarios.map((scenario) => {
      console.log(
        `- scheduled scenario=${scenario.name} matchId=${scenario.matchId} events=${scenario.events.length}`,
      );

      return runner.run({ scenario, speedFactor });
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      console.log(
        `Simulation finished: eventsPublished=${result.eventsPublished} matchId=${result.matchId} durationMs=${result.durationMs}`,
      );
    }
  } finally {
    await producer.disconnect();
  }
}

function readOption(args: string[], names: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (!names.includes(current)) {
      continue;
    }

    return args[index + 1];
  }

  return undefined;
}

function hasFlag(args: string[], names: string[]): boolean {
  return args.some((arg) => names.includes(arg));
}

function parseSpeedFactor(input: string): number {
  const normalized = input.trim().toLowerCase().replace(/x$/, '');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid speed factor: ${input}`);
  }

  return value;
}

function printHelp(): void {
  console.log('Simulator CLI');
  console.log('');
  console.log('Commands:');
  console.log('  list');
  console.log('  run --scenario <name|path> [--speed <factor>] [--fresh-match-ids]');
  console.log('');
  console.log('Examples:');
  console.log('  tsx src/cli.ts list');
  console.log('  tsx src/cli.ts run --scenario normal-match --speed 60x');
  console.log('  tsx src/cli.ts run --scenario normal-match --speed 60x --fresh-match-ids');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
