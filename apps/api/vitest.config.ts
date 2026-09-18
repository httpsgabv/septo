import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] },
  // SWC instead of esbuild: esbuild does not emit decorator metadata, which Nest DI relies on
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
