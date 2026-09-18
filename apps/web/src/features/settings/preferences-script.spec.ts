import { describe, expect, it } from 'vitest';
import { parsePreferences, resolveTheme } from './domain/preferences';
import { PREFERENCES_SCRIPT } from './preferences-script';

/** Runs the inline <head> script against a fake browser and reports what it applied. */
function runScript(stored: string | null, prefersDark: boolean) {
  const classes = new Set<string>();
  const style = new Map<string, string>();
  const browser = {
    localStorage: { getItem: () => stored },
    matchMedia: () => ({ matches: prefersDark, addEventListener: () => {} }),
    document: {
      documentElement: {
        classList: {
          toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
        },
        style: {
          setProperty: (name: string, value: string) => style.set(name, value),
          removeProperty: (name: string) => style.delete(name),
        },
      },
    },
  };
  new Function('localStorage', 'matchMedia', 'document', PREFERENCES_SCRIPT)(
    browser.localStorage,
    browser.matchMedia,
    browser.document,
  );
  return { dark: classes.has('dark'), accent: style.get('--accent-base') };
}

describe('PREFERENCES_SCRIPT', () => {
  it.each([
    [null, true],
    [null, false],
    ['{"theme":"light","accent":"#2563EB"}', true],
    ['{"theme":"dark","accent":"#db2777"}', false],
    ['{"theme":"system","accent":"javascript:alert(1)"}', true],
    ['{"theme":"sepia"}', false],
    ['not json', true],
  ])(
    'applies the same result as the TypeScript domain for %s (prefers dark: %s)',
    (stored, prefersDark) => {
      const expected = parsePreferences(stored);
      expect(runScript(stored, prefersDark)).toEqual({
        dark: resolveTheme(expected.theme, prefersDark) === 'dark',
        accent: expected.accent,
      });
    },
  );
});
