import { createApp } from './app.js';
import { loadEnv } from './shared/env.js';

const env = loadEnv();
const app = await createApp();
await app.listen(env.API_PORT);
