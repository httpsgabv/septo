import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../domain/password-hasher.js';

const argon2Async = promisify(argon2);

// OWASP: m = 19 MiB, t = 2, p = 1. Changing these needs approval (see SPEC-identity).
const MEMORY_KIB = 19_456;
const PASSES = 2;
const PARALLELISM = 1;
const SALT_BYTES = 16;
const TAG_BYTES = 32;

const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** argon2id from `node:crypto`, stored as a PHC string: `$argon2id$v=19$m=…,t=…,p=…$salt$hash`. */
@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const tag = await derive(password, salt, MEMORY_KIB, PASSES, PARALLELISM, TAG_BYTES);
    return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${b64(salt)}$${b64(tag)}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const match = PHC.exec(hash);
    if (!match) return false;
    const [, m = '', t = '', p = '', salt = '', tag = ''] = match;
    const [memory, passes, parallelism] = [Number(m), Number(t), Number(p)];
    if (memory < 8 * parallelism || passes < 1 || parallelism < 1) return false;

    const expected = Buffer.from(tag, 'base64');
    const actual = await derive(
      password,
      Buffer.from(salt, 'base64'),
      memory,
      passes,
      parallelism,
      expected.length,
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

function derive(
  password: string,
  nonce: Buffer,
  memory: number,
  passes: number,
  parallelism: number,
  tagLength: number,
): Promise<Buffer> {
  return argon2Async('argon2id', {
    message: password,
    nonce,
    memory,
    passes,
    parallelism,
    tagLength,
  });
}

/** PHC uses unpadded standard base64. */
const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
