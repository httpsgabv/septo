import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

export type OpenApiSchema = ApiResponseSchemaHost['schema'];

/** Named schemas (`.meta({ id })`) collected while decorators run; merged into the document's components. */
export const openApiComponents: Record<string, OpenApiSchema> = {};

export function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output'): OpenApiSchema {
  // zod's openapi-3.0 target emits `#/definitions/*`; OpenAPI expects `#/components/schemas/*`.
  const json = JSON.stringify(z.toJSONSchema(schema, { target: 'openapi-3.0', io }));
  const { definitions = {}, ...root } = JSON.parse(
    json.replaceAll('#/definitions/', '#/components/schemas/'),
  ) as OpenApiSchema & { definitions?: Record<string, OpenApiSchema> };

  for (const [id, definition] of Object.entries(definitions)) registerComponent(id, definition);
  return root;
}

function registerComponent(id: string, definition: OpenApiSchema) {
  const existing = openApiComponents[id];
  if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) {
    throw new Error(
      `OpenAPI schema "${id}" has two different shapes (input vs output?). Give each one its own id.`,
    );
  }
  openApiComponents[id] = definition;
}
