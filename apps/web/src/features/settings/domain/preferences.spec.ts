import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, parsePreferences, resolveTheme } from './preferences';

describe('parsePreferences', () => {
  it('reads stored preferences', () => {
    expect(parsePreferences('{"theme":"light","accent":"#2563EB"}')).toEqual({
      theme: 'light',
      accent: '#2563eb',
    });
  });

  it('falls back per field when a value is missing or invalid', () => {
    expect(parsePreferences('{"theme":"sepia","accent":"#2563eb"}')).toEqual({
      theme: DEFAULT_PREFERENCES.theme,
      accent: '#2563eb',
    });
    expect(parsePreferences('{"theme":"dark","accent":"red; background: url(x)"}')).toEqual({
      theme: 'dark',
      accent: DEFAULT_PREFERENCES.accent,
    });
  });

  it('returns the defaults for empty or corrupt storage', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('[]')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('resolveTheme', () => {
  it('follows the system only when the preference is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
