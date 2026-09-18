import { Body, Param, Query } from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { z } from 'zod';
import { errorResponse } from './error-response.schema.js';
import { type OpenApiSchema, toOpenApiSchema } from './openapi-schema.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/*
 * Input decorators are parameter decorators: they validate that one argument with the schema
 * and document it on the handler (including its 400 VALIDATION_ERROR). Handlers receive the parsed
 * value (coercions/defaults applied).
 */

export const ZodBody =
  (schema: z.ZodType): ParameterDecorator =>
  (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    decorateMethod(target, key, VALIDATION_ERROR_RESPONSE);
    decorateMethod(target, key, ApiBody({ schema: toOpenApiSchema(schema, 'input') }));
  };

export const ZodQuery =
  (schema: z.ZodObject): ParameterDecorator =>
  (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key, index);
    decorateMethod(target, key, VALIDATION_ERROR_RESPONSE);
    for (const [name, property, required] of objectProperties(schema)) {
      decorateMethod(target, key, ApiQuery({ name, required, schema: property }));
    }
  };

export const ZodParams =
  (schema: z.ZodObject): ParameterDecorator =>
  (target, key, index) => {
    Param(new ZodValidationPipe(schema))(target, key, index);
    decorateMethod(target, key, VALIDATION_ERROR_RESPONSE);
    for (const [name, property] of objectProperties(schema)) {
      decorateMethod(target, key, ApiParam({ name, schema: property }));
    }
  };

/** Documents a response. Does not validate it: presentation mappers own the response shape. */
export const ZodResponse = (status: number, schema?: z.ZodType): MethodDecorator =>
  ApiResponse({ status, ...(schema && { schema: toOpenApiSchema(schema, 'output') }) });

const VALIDATION_ERROR_RESPONSE = ZodResponse(400, errorResponse);

function decorateMethod(
  target: object,
  key: string | symbol | undefined,
  decorator: MethodDecorator,
) {
  if (key === undefined) throw new Error('Zod input decorators only work on handler parameters');
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) decorator(target, key, descriptor);
}

function objectProperties(schema: z.ZodObject): [string, OpenApiSchema, boolean][] {
  const { properties = {}, required = [] } = toOpenApiSchema(schema, 'input') as {
    properties?: Record<string, OpenApiSchema>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, property]) => [
    name,
    property,
    required.includes(name),
  ]);
}
