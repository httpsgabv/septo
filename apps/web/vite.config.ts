import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import { parseServerEnv } from './src/shared/env.ts';

// Local dev reads the monorepo root .env; containers inject variables directly.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const env = parseServerEnv(process.env);

export default defineConfig({
  server: {
    // IPv4 loopback: reachable by Caddy through host.docker.internal (plain `localhost` binds ::1 on
    // Windows), without exposing the dev server to the local network like 0.0.0.0 would.
    host: '127.0.0.1',
    port: env.WEB_PORT,
    strictPort: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Same-origin /api in dev, mirroring Caddy in production. Nitro handles requests before
    // Vite's own `server.proxy`, so the proxy has to live here.
    nitro({ devProxy: { '/api/**': env.API_INTERNAL_URL } }),
    viteReact(),
  ],
});
