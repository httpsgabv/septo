import { Injectable } from '@nestjs/common';
import { LoginAttempts } from '../domain/login-attempts.js';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;

/**
 * Failed logins per IP in a sliding 15 minute window.
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
    const recent = this.recent(ip);
    if (recent.length < MAX_FAILURES) return 0;
    // Blocked until enough old failures expire to drop below the limit.
    const unblocksAt = (recent[recent.length - MAX_FAILURES] as number) + WINDOW_MS;
    return Math.ceil((unblocksAt - this.now()) / 1000);
  }

  recordFailure(ip: string): void {
    this.sweep();
    this.failures.set(ip, [...this.recent(ip), this.now()]);
  }

  reset(ip: string): void {
    this.failures.delete(ip);
  }

  /** Tracked IPs; for tests. */
  get size() {
    return this.failures.size;
  }

  private recent(ip: string): number[] {
    const cutoff = this.now() - WINDOW_MS;
    return (this.failures.get(ip) ?? []).filter((at) => at > cutoff);
  }

  /** Keeps memory bounded: drops IPs whose failures all expired, at most once a minute. */
  private sweep() {
    const now = this.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    for (const ip of this.failures.keys()) {
      if (this.recent(ip).length === 0) this.failures.delete(ip);
    }
  }
}
