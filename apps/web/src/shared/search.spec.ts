import { describe, expect, it } from 'vitest';
import { matchesSearch } from './search';

describe('matchesSearch', () => {
  it('matches substrings of the value or keywords, ignoring case and accents', () => {
    expect(matchesSearch('Configurações', 'configuracoes')).toBe(1);
    expect(matchesSearch('Dev Tools', 'RSA', ['JSON, chaves RSA'])).toBe(1);
    expect(matchesSearch('Notas', '  not ')).toBe(1);
  });

  it('does not fuzzy-match scattered letters', () => {
    expect(matchesSearch('Configurações', 'rsa', ['Tema e cor de destaque'])).toBe(0);
  });
});
