import { describe, expect, it } from 'vitest';
import { findNavItem } from './navigation';

describe('findNavItem', () => {
  it('matches a section and its nested pages', () => {
    expect(findNavItem('/notes')?.label).toBe('Notas');
    expect(findNavItem('/notes/123')?.label).toBe('Notas');
  });

  it('does not match sections that only share a prefix', () => {
    expect(findNavItem('/notes-archive')).toBeUndefined();
    expect(findNavItem('/')).toBeUndefined();
  });
});
