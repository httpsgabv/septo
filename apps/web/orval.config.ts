import { defineConfig } from 'orval';

const input = '../api/openapi.json';

export default defineConfig({
  api: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/shared/api/generated/endpoints',
      schemas: 'src/shared/api/generated/models',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: { mutator: { path: 'src/shared/api/http-client.ts', name: 'httpClient' } },
    },
  },
  zod: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/shared/api/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
    },
  },
});
