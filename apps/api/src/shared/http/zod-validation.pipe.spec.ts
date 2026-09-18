import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const pipe = new ZodValidationPipe(
  z.object({ page: z.coerce.number().int().default(1), tag: z.string().min(2) }),
);

describe('ZodValidationPipe', () => {
  it('returns the parsed value with coercion and defaults applied', () => {
    expect(pipe.transform({ tag: 'dev' })).toEqual({ page: 1, tag: 'dev' });
    expect(pipe.transform({ page: '3', tag: 'dev' })).toEqual({ page: 3, tag: 'dev' });
  });

  it('rejects invalid input with a VALIDATION_ERROR listing each issue path', () => {
    try {
      pipe.transform({ page: 'x', tag: 'a' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'page', message: expect.any(String) },
          { path: 'tag', message: expect.any(String) },
        ],
      });
    }
  });
});
