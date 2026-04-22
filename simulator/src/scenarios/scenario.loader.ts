import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MatchScenario } from './scenario.types';
import { parseScenario } from './scenario.validator';

export const DEFAULT_SCENARIOS_DIR = path.resolve(process.cwd(), 'scenarios');

export async function listScenarios(scenariosDir = DEFAULT_SCENARIOS_DIR): Promise<string[]> {
  const entries = await readdir(scenariosDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

export async function loadScenario(input: string, scenariosDir = DEFAULT_SCENARIOS_DIR): Promise<MatchScenario> {
  const scenarios = await loadScenarios(input, scenariosDir);

  if (scenarios.length === 0) {
    throw new Error('No scenarios found in file');
  }

  return scenarios[0];
}

export async function loadScenarios(input: string, scenariosDir = DEFAULT_SCENARIOS_DIR): Promise<MatchScenario[]> {
  const filePath = resolveScenarioPath(input, scenariosDir);
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.map((p) => parseScenario(p));
  }

  return [parseScenario(parsed)];
}

function resolveScenarioPath(input: string, scenariosDir: string): string {
  const looksLikePath = input.endsWith('.json') || input.includes('/') || input.includes('\\');

  if (looksLikePath) {
    return path.resolve(process.cwd(), input);
  }

  return path.resolve(scenariosDir, `${input}.json`);
}