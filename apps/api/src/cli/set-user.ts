import { createInterface } from 'node:readline/promises';
import { type Readable, Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SetUserUseCase } from '../modules/identity/application/set-user.use-case.js';
import { IdentityModule } from '../modules/identity/identity.module.js';
import { DomainError } from '../shared/domain-error.js';
import { SharedModule } from '../shared/shared.module.js';

type Io = { stdin: Readable & { isTTY?: boolean }; stdout: Writable; stderr: Writable };

@Module({ imports: [SharedModule, IdentityModule] })
class CliModule {}

/**
 * `set-user <username>`: creates the single user or resets its username and password.
 * Interactive: asks for the password twice, without echo. Piped: the first stdin line is the password.
 */
export async function runSetUser(args: string[], io: Io): Promise<number> {
  const [username] = args;
  if (!username) {
    io.stderr.write('Usage: set-user <username>\n');
    return 1;
  }

  try {
    const password = await readPassword(io);
    const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error'] });
    try {
      const { created } = await app.get(SetUserUseCase).execute({ username, password });
      io.stdout.write(
        created
          ? `User "${username}" created.\n`
          : `User "${username}" updated. Every session was signed out.\n`,
      );
    } finally {
      await app.close();
    }
    return 0;
  } catch (error) {
    // Only our own errors are safe to print; anything else could carry connection details.
    io.stderr.write(
      `${error instanceof DomainError || error instanceof CliError ? error.message : 'Unexpected error while saving the user'}\n`,
    );
    return 1;
  }
}

class CliError extends Error {}

async function readPassword(io: Io): Promise<string> {
  if (!io.stdin.isTTY) {
    const [line = ''] = (await readAll(io.stdin)).split('\n');
    return line.replace(/\r$/, '');
  }
  const [first, second] = await promptHidden(['Password: ', 'Repeat password: '], io);
  if (first !== second) throw new CliError('Passwords do not match');
  return first ?? '';
}

async function readAll(stream: Readable): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  return text;
}

/** One readline for all prompts: a second interface on the same stdin would miss buffered input. */
async function promptHidden(questions: string[], io: Io): Promise<string[]> {
  const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
  const rl = createInterface({ input: io.stdin, output: muted, terminal: true });
  const answers: string[] = [];
  try {
    for (const question of questions) {
      io.stdout.write(question);
      answers.push(await rl.question(''));
      io.stdout.write('\n');
    }
  } finally {
    rl.close();
  }
  return answers;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runSetUser(process.argv.slice(2), {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
