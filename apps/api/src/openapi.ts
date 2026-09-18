import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { errorResponse } from './shared/http/error-response.schema.js';
import { openApiComponents, toOpenApiSchema } from './shared/http/openapi-schema.js';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('septo API').setVersion('0.0.0').build();
  const document = SwaggerModule.createDocument(app, config, { operationIdFactory: operationId });
  // Always published so clients get the error type even before an endpoint references it.
  toOpenApiSchema(errorResponse, 'output');
  assertUniqueOperationIds(document);

  const schemas = { ...document.components?.schemas, ...openApiComponents };
  document.components = {
    ...document.components,
    schemas: Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b))),
  };
  return document;
}

export function serveApiDocs(app: INestApplication, document: OpenAPIObject) {
  app.use('/api/openapi.json', (_req: unknown, res: { json(body: unknown): void }) =>
    res.json(document),
  );
  app.use('/api/docs', apiReference({ url: '/api/openapi.json', theme: 'purple' }));
}

/**
 * `NotesController.archive` → `notesArchive` (Orval hook: `useNotesArchive`). Scoping by controller
 * keeps ids unique across the API while handlers keep short names.
 */
export function operationId(controllerKey: string, methodKey: string): string {
  const resource = controllerKey.replace(/Controller$/, '');
  return `${resource.charAt(0).toLowerCase()}${resource.slice(1)}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
}

/** Guards against two controllers sharing a class name in different modules. */
function assertUniqueOperationIds(document: OpenAPIObject) {
  const seen = new Set<string>();
  for (const path of Object.values(document.paths)) {
    for (const operation of Object.values(path)) {
      const id = (operation as { operationId?: string }).operationId;
      if (!id) continue;
      if (seen.has(id))
        throw new Error(`Duplicate operationId "${id}": rename one of the handlers`);
      seen.add(id);
    }
  }
}
