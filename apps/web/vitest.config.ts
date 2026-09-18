import { defineConfig } from 'vitest/config';

// Unit tests cover pure code (features/*/domain, shared); the app plugins are not needed here.
export default defineConfig({ test: { include: ['src/**/*.spec.{ts,tsx}'] } });
