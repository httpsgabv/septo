// Runs before the servers start (see playwright.config.ts): migrates septo_test and (re)creates the
// e2e user with the same CLI used in production. Values come from constants.ts through the env.
import { execFileSync } from 'node:child_process';

const { E2E_DATABASE_URL, E2E_USERNAME, E2E_PASSWORD } = process.env;
const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
const run = (command, args, options = {}) =>
  execFileSync(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'], ...options });

run('npx', ['prisma', 'generate'], { cwd: 'apps/api' });
run('npx', ['prisma', 'migrate', 'deploy'], { cwd: 'apps/api' });
run('npm', ['run', 'user:set', '-w', '@septo/api', '--', E2E_USERNAME], {
  input: `${E2E_PASSWORD}\n`,
  stdio: ['pipe', 'inherit', 'inherit'],
});
