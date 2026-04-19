const { spawn, spawnSync } = require('child_process');
const { randomUUID } = require('crypto');

const ROOT_CWD = process.cwd();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCmdSync(cmd, args, timeout = 30000) {
  try {
    const out = spawnSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      cwd: ROOT_CWD,
    });

    return {
      status: out.status,
      stdout: out.stdout ?? '',
      stderr: out.stderr ?? '',
    };
  } catch (error) {
    return {
      status: -1,
      stdout: '',
      stderr: String(error),
    };
  }
}

async function runProducer(eventJson) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'kafka',
        'kafka-console-producer',
        '--bootstrap-server',
        'kafka:29092',
        '--topic',
        'match.events',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT_CWD },
    );

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`producer exited with code ${code}: ${stderr.trim()}`));
    });

    proc.stdin.write(eventJson + '\n');
    proc.stdin.end();
  });
}

function getMatchFromPostgres(matchId) {
  const sql = `SELECT id,status,home_score,away_score,current_minute FROM odds_engine.matches WHERE id = '${matchId}';`;
  return runCmdSync('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'betting_engine',
    '-t',
    '-A',
    '-F',
    ',',
    '-c',
    sql,
  ]);
}

function getOddsFromRedis(matchId) {
  return runCmdSync('docker', [
    'compose',
    'exec',
    '-T',
    'redis',
    'redis-cli',
    'GET',
    `odds:${matchId}`,
  ]);
}

async function waitForPersistence(matchId, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const pg = getMatchFromPostgres(matchId);
    const redis = getOddsFromRedis(matchId);

    const pgHasMatch = pg.status === 0 && pg.stdout.includes(matchId);
    const redisHasOdds =
      redis.status === 0 &&
      redis.stdout.trim().length > 0 &&
      !redis.stdout.includes('(nil)');

    if (pgHasMatch && redisHasOdds) {
      return { pg, redis, ok: true };
    }

    await sleep(1000);
  }

  return {
    ok: false,
    pg: getMatchFromPostgres(matchId),
    redis: getOddsFromRedis(matchId),
  };
}

async function main() {
  const eventId = randomUUID();
  const matchId = randomUUID();
  const event = {
    id: eventId,
    matchId,
    provider: 'simulator',
    providerEventId: `evt-${eventId.slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'GOAL',
    payload: {
      homeScore: 1,
      awayScore: 0,
      minute: 12,
      team: 'HOME',
    },
  };

  const eventJson = JSON.stringify(event);
  try {
    const dockerPs = runCmdSync('docker', ['compose', 'ps']);
    if (dockerPs.status !== 0) {
      throw new Error(`docker compose is not healthy:\n${dockerPs.stderr || dockerPs.stdout}`);
    }

    console.log('This script expects odds-engine already running in another terminal.');
    console.log('Publishing through Kafka topic match.events so MatchEventsConsumer handles business logic.');

    console.log(`Publishing event to match.events via Kafka producer: ${eventJson}`);
    await runProducer(eventJson);

    const verification = await waitForPersistence(matchId);
    if (!verification.ok) {
      throw new Error(
        [
          'Timed out waiting for persistence in Postgres and Redis.',
          `Postgres output: ${verification.pg.stdout || verification.pg.stderr}`,
          `Redis output: ${verification.redis.stdout || verification.redis.stderr}`,
        ].join('\n'),
      );
    }

    console.log('\nPostgres row found:');
    console.log(verification.pg.stdout.trim());
    console.log('\nRedis odds found:');
    console.log(verification.redis.stdout.trim());
    console.log(`\nE2E SUCCESS matchId=${matchId} eventId=${eventId}`);
    console.log('If odds-engine logs show PROCESSED ..., the app logic path is confirmed end-to-end.');
  } catch (error) {
    console.error('\nE2E FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
