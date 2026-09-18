import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({})).toEqual({ API_PORT: 3333, API_DOCS_ENABLED: true });
  });

  it('coerces string values', () => {
    expect(parseEnv({ API_PORT: '4000', API_DOCS_ENABLED: 'false' })).toEqual({
      API_PORT: 4000,
      API_DOCS_ENABLED: false,
    });
  });

  it('fails fast naming the invalid variable', () => {
    expect(() => parseEnv({ API_PORT: 'abc' })).toThrow(/API_PORT/);
  });
});
