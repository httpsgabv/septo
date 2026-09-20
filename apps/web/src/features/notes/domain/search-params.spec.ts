import { describe, expect, it } from 'vitest';
import { notesSearchSchema, toListParams } from './search-params';

const parse = (input: unknown) => notesSearchSchema.parse(input);

describe('notesSearchSchema', () => {
  it('keeps valid q, tag and view', () => {
    expect(parse({ q: 'anotação', tag: 'trabalho', view: 'archived' })).toEqual({
      q: 'anotação',
      tag: 'trabalho',
      view: 'archived',
    });
  });

  it('is empty for an empty URL', () => {
    expect(parse({})).toEqual({});
  });

  it('drops an invalid view instead of failing', () => {
    expect(parse({ view: 'trash' }).view).toBeUndefined();
    expect(parse({ view: 42 }).view).toBeUndefined();
  });

  it('drops a q or tag longer than 200 characters', () => {
    expect(parse({ q: 'a'.repeat(201) }).q).toBeUndefined();
    expect(parse({ tag: 'a'.repeat(201) }).tag).toBeUndefined();
    expect(parse({ q: 'a'.repeat(200) }).q).toHaveLength(200);
  });

  it.each(['', '   '])('treats a blank q (%j) as absent', (q) => {
    expect(parse({ q }).q).toBeUndefined();
  });

  it('reads a numeric q as text (the router JSON-parses `?q=123` into a number)', () => {
    expect(parse({ q: 123 }).q).toBe('123');
  });

  it('drops values that are neither text nor numbers', () => {
    expect(parse({ q: { a: 1 }, tag: ['a'] })).toEqual({});
  });

  it('strips unknown params', () => {
    expect(parse({ q: 'a', other: 'x' })).toEqual({ q: 'a' });
  });
});

describe('toListParams', () => {
  it('leaves out what is not set, and the default view', () => {
    expect(toListParams({})).toEqual({});
    expect(toListParams({ view: 'active' })).toEqual({});
  });

  it('passes q, tag and a non-default view to the API', () => {
    expect(toListParams({ q: 'a', tag: 'b', view: 'reminders' })).toEqual({
      q: 'a',
      tag: 'b',
      view: 'reminders',
    });
  });
});
