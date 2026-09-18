import { createApp } from './app.js';
import { createOpenApiDocument, serveApiDocs } from './openapi.js';
import { loadEnv } from './shared/env.js';

const env = loadEnv();
const app = await createApp();
if (env.API_DOCS_ENABLED) serveApiDocs(app, createOpenApiDocument(app));
await app.listen(env.API_PORT);
