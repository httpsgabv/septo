import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { AUTH_FILE, BASE_URL, E2E_PASSWORD, E2E_USERNAME } from './constants';

/** Signs in once through the API; every suite reuses the cookie as its `storageState`. */
export default async function globalSetup() {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    // The web server is up when this runs, but the API (started by the same turbo run) may lag.
    for (let attempt = 0; ; attempt++) {
      const health = await api.get('/api/health').catch(() => undefined);
      if (health?.ok()) break;
      if (attempt >= 60) throw new Error('The API did not become healthy in 60s');
      await new Promise((done) => setTimeout(done, 1000));
    }

    const login = await api.post('/api/auth/login', {
      data: { username: E2E_USERNAME, password: E2E_PASSWORD },
    });
    if (!login.ok()) throw new Error(`e2e login failed: ${login.status()} ${await login.text()}`);

    mkdirSync(dirname(AUTH_FILE), { recursive: true });
    await api.storageState({ path: AUTH_FILE });
  } finally {
    await api.dispose();
  }
}
