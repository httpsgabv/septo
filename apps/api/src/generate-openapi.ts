import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { createOpenApiDocument } from './openapi.js';

// Writes apps/api/openapi.json without opening a port; the web codegen reads this file.
const app = await createApp({ logger: false });
const document = createOpenApiDocument(app);
writeFileSync(
  resolve(import.meta.dirname, '../openapi.json'),
  `${JSON.stringify(document, null, 2)}\n`,
);
await app.close();
