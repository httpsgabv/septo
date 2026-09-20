import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({})).toEqual({
      API_PORT: 3333,
      API_DOCS_ENABLED: true,
      DATABASE_URL: 'postgresql://septo:septo@localhost:5433/septo',
      JWT_SECRET: expect.stringMatching(/^.{32,}$/),
    });
  });

  it('coerces string values', () => {
    expect(parseEnv({ API_PORT: '4000', API_DOCS_ENABLED: 'false' })).toMatchObject({
      API_PORT: 4000,
      API_DOCS_ENABLED: false,
    });
  });

  it('fails fast naming the invalid variable', () => {
    expect(() => parseEnv({ API_PORT: 'abc' })).toThrow(/API_PORT/);
    expect(() => parseEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  describe('JWT_SECRET', () => {
    const production = { NODE_ENV: 'production' };

    it('is required in production', () => {
      expect(() => parseEnv(production)).toThrow(/JWT_SECRET/);
    });

    it('needs at least 32 characters in production', () => {
      expect(() => parseEnv({ ...production, JWT_SECRET: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
      expect(parseEnv({ ...production, JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET).toBe(
        'x'.repeat(32),
      );
    });

    it('falls back to a fixed dev secret outside production', () => {
      expect(parseEnv({}).JWT_SECRET).toBe(parseEnv({ NODE_ENV: 'test' }).JWT_SECRET);
    });

    it('uses the provided value outside production', () => {
      expect(parseEnv({ JWT_SECRET: 'short' }).JWT_SECRET).toBe('short');
    });
  });
});
