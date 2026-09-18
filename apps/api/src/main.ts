import { createApp } from './app.js';
import { createOpenApiDocument, serveApiDocs } from './openapi.js';
import { ENV, type Env } from './shared/env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
if (env.API_DOCS_ENABLED) serveApiDocs(app, createOpenApiDocument(app));
await app.listen(env.API_PORT);
