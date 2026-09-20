import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodResponse } from '../../../shared/http/zod.decorators.js';
import { ListTagsUseCase } from '../application/list-tags.use-case.js';

/** Apart from `NotesController`, so `GET /tags` never competes with `GET /notes/:id`. */
@Controller('tags')
export class TagsController {
  constructor(private readonly listTags: ListTagsUseCase) {}

  @Get()
  @ZodResponse(200, z.array(z.string()))
  @ZodResponse(401, errorResponse)
  list(): Promise<string[]> {
    return this.listTags.execute();
  }
}
