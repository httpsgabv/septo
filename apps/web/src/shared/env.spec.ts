import { describe, expect, it } from 'vitest';
import { parseServerEnv } from './env';

describe('parseServerEnv', () => {
  it('applies local defaults', () => {
    expect(parseServerEnv({})).toEqual({
      WEB_PORT: 5173,
      API_INTERNAL_URL: 'http://localhost:3333',
    });
  });

  it('fails fast naming the invalid variable', () => {
    expect(() => parseServerEnv({ API_INTERNAL_URL: 'not a url' })).toThrow(/API_INTERNAL_URL/);
  });
});
