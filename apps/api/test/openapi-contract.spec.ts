import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createOpenApiDocument } from '../src/openapi.js';

describe('openapi.json', () => {
  it('matches the API — run `npm run openapi -w @septo/api` after changing the contract', async () => {
    const app = await createApp({ logger: false });
    const generated = `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`;
    await app.close();

    const committed = readFileSync(resolve(import.meta.dirname, '../openapi.json'), 'utf8');
    expect(committed).toBe(generated);
  });
});
