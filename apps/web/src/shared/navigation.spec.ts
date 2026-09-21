import { describe, expect, it } from 'vitest';
import { tools } from '../features/dev-tools/domain/tools';
import { findNavItem, toolsNavigation } from './navigation';

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

describe('toolsNavigation', () => {
  it('nests the six dev tools under Dev Tools, and keeps the parent active inside them', () => {
    const devTools = toolsNavigation.find((item) => item.to === '/dev-tools');
    expect(devTools?.children?.map((child) => child.to)).toEqual(tools.map((tool) => tool.to));
    expect(findNavItem('/dev-tools/json')?.label).toBe('Dev Tools');
  });
});
