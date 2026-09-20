import { PassThrough, Writable } from 'node:stream';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runSetUser } from '../src/cli/set-user.js';
import { loadEnv } from '../src/shared/env.js';
import { PrismaService } from '../src/shared/prisma.service.js';

const prisma = new PrismaService(loadEnv());

function run(args: string[], stdin: string) {
  const input = new PassThrough();
  input.end(stdin);
  let out = '';
  let err = '';
  const sink = (append: (chunk: string) => void) =>
    new Writable({
      write(chunk, _enc, done) {
        append(String(chunk));
        done();
      },
    });
  return runSetUser(args, {
    stdin: input,
    stdout: sink((c) => {
      out += c;
    }),
    stderr: sink((c) => {
      err += c;
    }),
  }).then((exitCode) => ({ exitCode, out, err }));
}

describe('set-user CLI', () => {
  beforeEach(() => prisma.user.deleteMany());
  afterAll(() => prisma.$disconnect());

  it('creates the user and then resets it, dropping every session', async () => {
    const created = await run(['gabriel'], 'first-password-123\n');
    expect(created.exitCode).toBe(0);
    const first = await prisma.user.findUniqueOrThrow({ where: { username: 'gabriel' } });
    expect(first.tokenVersion).toBe(0);
    expect(first.passwordHash).toMatch(/^\$argon2id\$/);

    const reset = await run(['gabriel'], 'second-password-456\n');
    expect(reset.exitCode).toBe(0);
    const second = await prisma.user.findUniqueOrThrow({ where: { username: 'gabriel' } });
    expect(await prisma.user.count()).toBe(1);
    expect(second.id).toBe(first.id);
    expect(second.tokenVersion).toBe(1);
    expect(second.passwordHash).not.toBe(first.passwordHash);
  });

  it('never prints the password', async () => {
    const { out, err } = await run(['gabriel'], 'first-password-123\n');

    expect(out + err).not.toContain('first-password-123');
  });

  it('fails without a username', async () => {
    const { exitCode, err } = await run([], 'first-password-123\n');

    expect(exitCode).toBe(1);
    expect(err).toContain('Usage');
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ['too short', 'short\n'],
    ['missing', ''],
  ])('fails with a %s password and leaves the database alone', async (_case, stdin) => {
    const { exitCode, err } = await run(['gabriel'], stdin);

    expect(exitCode).toBe(1);
    expect(err).not.toBe('');
    expect(await prisma.user.count()).toBe(0);
  });
});
