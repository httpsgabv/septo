import { resolve } from 'node:path';

// e2e runs its own API and web on other ports and against `septo_test`, so it never reuses (or
// writes to) the servers and the database you develop with.
export const E2E_API_PORT = 3433;
export const E2E_WEB_PORT = 5273;
export const E2E_DATABASE_URL = 'postgresql://septo:septo@localhost:5433/septo_test';

// Test-only credentials for a user that exists only in septo_test.
export const E2E_USERNAME = 'e2e';
export const E2E_PASSWORD = 'e2e-only-password-123';

export const BASE_URL = `http://localhost:${E2E_WEB_PORT}`;
export const AUTH_FILE = resolve(import.meta.dirname, '.auth/state.json');
