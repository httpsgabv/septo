import { describe, expect, it } from 'vitest';
import { DatabaseHealthCheck } from '../domain/database-health-check.js';
import { CheckHealthUseCase } from './check-health.use-case.js';

class FakeDatabaseHealthCheck extends DatabaseHealthCheck {
  constructor(private readonly up: boolean) {
    super();
  }
  isUp() {
    return Promise.resolve(this.up);
  }
}

describe('CheckHealthUseCase', () => {
  it('reports ok when the database is up', async () => {
    const report = await new CheckHealthUseCase(new FakeDatabaseHealthCheck(true)).execute();
    expect(report).toEqual({ status: 'ok', db: 'up' });
  });

  it('reports degraded when the database is down', async () => {
    const report = await new CheckHealthUseCase(new FakeDatabaseHealthCheck(false)).execute();
    expect(report).toEqual({ status: 'degraded', db: 'down' });
  });
});
