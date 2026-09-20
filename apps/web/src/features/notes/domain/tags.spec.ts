import { describe, expect, it } from 'vitest';
import { addTags, MAX_TAGS, normalizeTag, TAG_ERRORS } from './tags';

// The cases below mirror apps/api/src/modules/notes/domain/tags.spec.ts: the web must accept and
// reject exactly what the API does, or a tag would pass the input and fail the autosave.
describe('normalizeTag', () => {
  it.each([
    ['  Trabalho ', 'trabalho'],
    ['TRABALHO', 'trabalho'],
    ['a b', 'a-b'],
    ['c   d', 'c-d'],
    ['Ação', 'ação'],
    ['v1.2', 'v1.2'],
    ['a_b-c', 'a_b-c'],
    ['2026', '2026'],
    ['é', 'é'],
    ['a', 'a'],
    ['b'.repeat(30), 'b'.repeat(30)],
  ])('%j → %j', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['31 characters', 'a'.repeat(31)],
    ['slash', 'a/b'],
    ['hash', '#a'],
    ['emoji', '🔥'],
    ['newline inside', 'a\nb'],
  ])('rejects a tag that is %s', (_case, input) => {
    expect(normalizeTag(input)).toBeNull();
  });
});

describe('addTags', () => {
  it('adds a tag typed or pasted, normalized', () => {
    expect(addTags([], '  Trabalho ')).toEqual({ tags: ['trabalho'] });
  });

  it('splits on commas, keeping the order', () => {
    expect(addTags(['a'], 'b, C ,d')).toEqual({ tags: ['a', 'b', 'c', 'd'] });
  });

  it('ignores an empty input and empty pieces without an error', () => {
    expect(addTags(['a'], '')).toEqual({ tags: ['a'] });
    expect(addTags(['a'], '  ')).toEqual({ tags: ['a'] });
    expect(addTags(['a'], 'b,, ,')).toEqual({ tags: ['a', 'b'] });
  });

  it('does not add a duplicate, in any case, and says so', () => {
    expect(addTags(['trabalho'], 'TRABALHO')).toEqual({
      tags: ['trabalho'],
      error: TAG_ERRORS.duplicate,
    });
    expect(addTags([], 'a, A')).toEqual({ tags: ['a'], error: TAG_ERRORS.duplicate });
  });

  it('does not add an invalid tag, and says so; the valid ones around it still go in', () => {
    expect(addTags(['a'], 'a/b')).toEqual({ tags: ['a'], error: TAG_ERRORS.invalid });
    expect(addTags([], 'x, a/b, y')).toEqual({ tags: ['x', 'y'], error: TAG_ERRORS.invalid });
    expect(addTags([], 'a'.repeat(31)).error).toBe(TAG_ERRORS.invalid);
  });

  it('stops at MAX_TAGS and says so', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTags(full, 'extra')).toEqual({ tags: full, error: TAG_ERRORS.limit });
    expect(addTags(full.slice(1), 'extra').tags).toHaveLength(MAX_TAGS);
    expect(addTags(full.slice(2), 'x, y, z').tags).toHaveLength(MAX_TAGS);
  });

  it('reports only the first problem', () => {
    expect(addTags(['a'], 'a, b/c').error).toBe(TAG_ERRORS.duplicate);
  });

  it('never returns more tags than the API accepts', () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(',');
    expect(addTags([], many).tags).toHaveLength(MAX_TAGS);
  });
});
