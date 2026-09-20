import { describe, expect, it } from 'vitest';
import { InvalidTagError } from './errors.js';
import { MAX_TAGS, normalizeTag, normalizeTags } from './tags.js';

describe('normalizeTags', () => {
  it('collapses "  Trabalho ", "trabalho" and "TRABALHO" into one tag', () => {
    expect(normalizeTags(['  Trabalho ', 'trabalho', 'TRABALHO'])).toEqual(['trabalho']);
  });

  it('turns spaces into dashes', () => {
    expect(normalizeTags(['a b', 'c   d'])).toEqual(['a-b', 'c-d']);
  });

  it('keeps the order of first appearance', () => {
    expect(normalizeTags(['b', 'a', 'B', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('accepts letters with accents, digits, dot, dash and underscore', () => {
    expect(normalizeTags(['Ação', 'v1.2', 'a_b-c', '2026'])).toEqual([
      'ação',
      'v1.2',
      'a_b-c',
      '2026',
    ]);
  });

  it('composes accents so the same word is never two tags', () => {
    expect(normalizeTags(['é', 'é'])).toEqual(['é']);
  });

  it('returns an empty list for no tags', () => {
    expect(normalizeTags([])).toEqual([]);
  });

  describe('limits', () => {
    it('accepts 1 and 30 characters', () => {
      expect(() => normalizeTags(['a', 'b'.repeat(30)])).not.toThrow();
    });

    it('rejects 31 characters', () => {
      expect(() => normalizeTags(['a'.repeat(31)])).toThrow(InvalidTagError);
    });

    it('accepts MAX_TAGS distinct tags and rejects one more', () => {
      const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`);
      expect(normalizeTags(tags.slice(0, MAX_TAGS))).toHaveLength(MAX_TAGS);
      expect(() => normalizeTags(tags)).toThrow(InvalidTagError);
    });

    it('counts distinct tags, not raw entries', () => {
      const tags = [...Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`), 'T0', ' t1 '];
      expect(normalizeTags(tags)).toHaveLength(MAX_TAGS);
    });
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['slash', 'a/b'],
    ['hash', '#a'],
    ['comma', 'a,b'],
    ['emoji', '🔥'],
    ['newline inside', 'a\nb'],
  ])('rejects a tag that is %s', (_case, tag) => {
    expect(() => normalizeTags(['ok', tag])).toThrow(InvalidTagError);
  });
});

describe('normalizeTag', () => {
  it('applies the same rules to a single tag', () => {
    expect(normalizeTag('  Casa Nova ')).toBe('casa-nova');
    expect(() => normalizeTag('a/b')).toThrow(InvalidTagError);
  });
});
