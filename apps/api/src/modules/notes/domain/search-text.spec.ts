import { describe, expect, it } from 'vitest';
import { buildSearchText, normalizeSearchText } from './search-text.js';

describe('normalizeSearchText', () => {
  it.each([
    ['Anotação', 'anotacao'],
    ['ÁÉÍÓÚ àèìòù âêîôû ãõ ç ü', 'aeiou aeiou aeiou ao c u'],
    ['MAIÚSCULAS', 'maiusculas'],
    ['é', 'e'], // already decomposed input
    ['plain', 'plain'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it('keeps digits, punctuation and markdown syntax untouched', () => {
    expect(normalizeSearchText('## Item 2: **Ok**')).toBe('## item 2: **ok**');
  });
});

describe('buildSearchText', () => {
  it('joins title and body, normalized', () => {
    const text = buildSearchText('Anotação', 'Corpo **Rápido**');
    expect(text).toContain('anotacao');
    expect(text).toContain('corpo **rapido**');
  });

  it('does not glue the end of the title to the start of the body', () => {
    expect(buildSearchText('abc', 'def')).not.toContain('abcdef');
  });
});
