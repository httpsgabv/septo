import { describe, expect, it } from 'vitest';
import { toolFor, tools } from './tools';

describe('tools', () => {
  it('has one route per tool, all under /dev-tools', () => {
    const routes = tools.map((tool) => tool.to);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.every((route) => route.startsWith('/dev-tools/'))).toBe(true);
  });

  it('gives every tool a label and a description for the card and the strip', () => {
    for (const tool of tools) {
      expect(tool.label.trim()).not.toBe('');
      expect(tool.description.trim()).not.toBe('');
    }
  });

  it('finds a tool by its route', () => {
    expect(toolFor('/dev-tools/rsa').label).toBe('Chaves RSA');
  });
});
