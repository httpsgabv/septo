import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  const productionVapid = {
    VAPID_PUBLIC_KEY: 'A'.repeat(87),
    VAPID_PRIVATE_KEY: 'B'.repeat(43),
    VAPID_SUBJECT: 'mailto:ops@example.com',
  };

  it('applies defaults', () => {
    expect(parseEnv({})).toEqual({
      API_PORT: 3333,
      API_DOCS_ENABLED: true,
      DATABASE_URL: 'postgresql://septo:septo@localhost:5433/septo',
      JWT_SECRET: expect.stringMatching(/^.{32,}$/),
      VAPID_PUBLIC_KEY: expect.stringMatching(/^[A-Za-z0-9_-]{87}$/),
      VAPID_PRIVATE_KEY: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      VAPID_SUBJECT: 'mailto:dev@septo.local',
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
      expect(
        parseEnv({ ...production, ...productionVapid, JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET,
      ).toBe('x'.repeat(32));
    });

    it('falls back to a fixed dev secret outside production', () => {
      expect(parseEnv({}).JWT_SECRET).toBe(parseEnv({ NODE_ENV: 'test' }).JWT_SECRET);
    });

    it('uses the provided value outside production', () => {
      expect(parseEnv({ JWT_SECRET: 'short' }).JWT_SECRET).toBe('short');
    });
  });

  describe('VAPID', () => {
    const production = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) };

    it('requires all values in production', () => {
      for (const missing of Object.keys(productionVapid)) {
        const values = { ...productionVapid };
        delete values[missing as keyof typeof values];
        expect(() => parseEnv({ ...production, ...values })).toThrow(new RegExp(missing));
      }
    });

    it('validates the key encoding and subject', () => {
      expect(() =>
        parseEnv({ ...production, ...productionVapid, VAPID_PUBLIC_KEY: 'not-a-key' }),
      ).toThrow(/VAPID_PUBLIC_KEY/);
      expect(() =>
        parseEnv({ ...production, ...productionVapid, VAPID_PRIVATE_KEY: 'not-a-key' }),
      ).toThrow(/VAPID_PRIVATE_KEY/);
      expect(() =>
        parseEnv({ ...production, ...productionVapid, VAPID_SUBJECT: 'ftp://example.com' }),
      ).toThrow(/VAPID_SUBJECT/);
    });

    it('rejects the fixed development key pair in production', () => {
      const development = parseEnv({});
      expect(() =>
        parseEnv({
          ...production,
          VAPID_PUBLIC_KEY: development.VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY: development.VAPID_PRIVATE_KEY,
          VAPID_SUBJECT: 'https://example.com',
        }),
      ).toThrow(/development VAPID keys/);
    });

    it('accepts an https subject', () => {
      expect(
        parseEnv({
          ...production,
          ...productionVapid,
          VAPID_SUBJECT: 'https://example.com/push',
        }).VAPID_SUBJECT,
      ).toBe('https://example.com/push');
    });
  });
});
