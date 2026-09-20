import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLoginAttempts } from './in-memory-login-attempts.js';

const MINUTE = 60 * 1000;
const T0 = new Date('2026-09-20T10:00:00.000Z').getTime();

describe('InMemoryLoginAttempts', () => {
  let attempts: InMemoryLoginAttempts;
  let now: number;
  const fail = (ip: string, times: number) => {
    for (let i = 0; i < times; i++) attempts.recordFailure(ip);
  };

  beforeEach(() => {
    now = T0;
    attempts = new InMemoryLoginAttempts();
    attempts.now = () => now;
  });

  it('lets an IP try until it has failed 5 times', () => {
    fail('1.1.1.1', 4);

    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(0);
  });

  it('blocks after the 5th failure and says how long to wait', () => {
    fail('1.1.1.1', 5);

    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(15 * 60);
    now += 5 * MINUTE;
    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(10 * 60);
  });

  it('rounds the wait up so a client that waits it out is never blocked again', () => {
    fail('1.1.1.1', 5);
    now += 15 * MINUTE - 500;

    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(1);
  });

  it('unblocks once the failures leave the 15 minute window', () => {
    fail('1.1.1.1', 5);
    now += 15 * MINUTE;

    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(0);
  });

  it('slides the window: old failures expire one by one', () => {
    fail('1.1.1.1', 3);
    now += 10 * MINUTE;
    fail('1.1.1.1', 2);
    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(5 * 60);

    now += 5 * MINUTE;
    // the 3 oldest expired; only 2 remain
    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(0);
  });

  it('a successful login clears the counter', () => {
    fail('1.1.1.1', 5);

    attempts.reset('1.1.1.1');

    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(0);
    fail('1.1.1.1', 4);
    expect(attempts.retryAfterSeconds('1.1.1.1')).toBe(0);
  });

  it('counts each IP on its own', () => {
    fail('1.1.1.1', 5);

    expect(attempts.retryAfterSeconds('2.2.2.2')).toBe(0);
    expect(attempts.retryAfterSeconds('1.1.1.1')).toBeGreaterThan(0);
  });

  it('forgets IPs whose failures all expired', () => {
    fail('1.1.1.1', 2);
    fail('2.2.2.2', 2);
    now += 16 * MINUTE;

    fail('3.3.3.3', 1);

    expect(attempts.size).toBe(1);
  });
});
