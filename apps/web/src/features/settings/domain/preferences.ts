export type ThemePreference = 'light' | 'dark' | 'system';

export type Preferences = {
  theme: ThemePreference;
  /** Lowercase `#rrggbb`; everything accent-related in the design system derives from it. */
  accent: string;
};

export const PREFERENCES_KEY = 'septo:preferences';

export const DEFAULT_PREFERENCES: Preferences = { theme: 'system', accent: '#5808a3' };

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export const ACCENT_PRESETS = [
  { name: 'Roxo septo', value: '#5808a3' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Âmbar', value: '#d97706' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Grafite', value: '#52525b' },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const THEMES = new Set<string>(THEME_OPTIONS.map((option) => option.value));

/** Never throws: anything unreadable falls back to the default, field by field. */
export function parsePreferences(raw: string | null): Preferences {
  let stored: unknown;
  try {
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  const { theme, accent } = (
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  ) as Record<string, unknown>;

  return {
    theme:
      typeof theme === 'string' && THEMES.has(theme)
        ? (theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
    accent:
      typeof accent === 'string' && HEX_COLOR.test(accent)
        ? accent.toLowerCase()
        : DEFAULT_PREFERENCES.accent,
  };
}

export function resolveTheme(theme: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}
