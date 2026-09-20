import { isIPv4, isIPv6 } from 'node:net';
import { Injectable } from '@nestjs/common';
import { LoginAttempts } from '../domain/login-attempts.js';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;

/**
 * Failed logins per client in a sliding 15 minute window (a client is an IPv4 address or an IPv6 /64).
 * ponytail: in memory, so it resets on restart and one instance only; and it does not stop an attack
 * spread over many IPs. Move to Postgres/Redis if septo ever runs more than one API instance.
 */
@Injectable()
export class InMemoryLoginAttempts extends LoginAttempts {
  private readonly failures = new Map<string, number[]>();
  private lastSweep = 0;
  /** Replaced in tests to move through time. */
  now = () => Date.now();

  retryAfterSeconds(ip: string): number {
    const recent = this.recent(clientKey(ip));
    if (recent.length < MAX_FAILURES) return 0;
    // Blocked until enough old failures expire to drop below the limit.
    const unblocksAt = (recent[recent.length - MAX_FAILURES] as number) + WINDOW_MS;
    return Math.ceil((unblocksAt - this.now()) / 1000);
  }

  recordAttempt(ip: string): void {
    const key = clientKey(ip);
    this.sweep();
    this.failures.set(key, [...this.recent(key), this.now()]);
  }

  reset(ip: string): void {
    this.failures.delete(clientKey(ip));
  }

  /** Tracked IPs; for tests. */
  get size() {
    return this.failures.size;
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - WINDOW_MS;
    return (this.failures.get(key) ?? []).filter((at) => at > cutoff);
  }

  /** Keeps memory bounded: drops IPs whose failures all expired, at most once a minute. */
  private sweep() {
    const now = this.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    for (const key of this.failures.keys()) {
      if (this.recent(key).length === 0) this.failures.delete(key);
    }
  }
}

/**
 * Who a login attempt is counted against. One IPv6 client controls a whole /64, so keying on the full
 * address would give it a fresh budget per address; IPv4-mapped addresses are plain IPv4.
 */
function clientKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  const address = (mapped ?? ip).split('%')[0] ?? '';
  if (isIPv4(address) || !isIPv6(address)) return address;

  const [head = '', tail = ''] = address.split('::');
  const before = head ? head.split(':') : [];
  const after = tail ? tail.split(':') : [];
  const hextets = address.includes('::')
    ? [...before, ...Array(8 - before.length - after.length).fill('0'), ...after]
    : before;
  return `${hextets
    .slice(0, 4)
    .map((h) => Number.parseInt(h, 16).toString(16))
    .join(':')}::/64`;
}
