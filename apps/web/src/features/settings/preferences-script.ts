import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  type Preferences,
  resolveTheme,
} from './domain/preferences';

/**
 * Inline <head> script: applies the stored theme and accent before the first paint (no flash) and
 * keeps "system" in sync with the OS. Plain JS because it runs before the app bundle loads;
 * preferences-script.spec.ts checks it against parsePreferences/resolveTheme so they cannot drift.
 */
export const PREFERENCES_SCRIPT = `(function () {
  var root = document.documentElement;
  function apply() {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})) || {}; } catch (e) {}
    if (typeof stored !== 'object' || Array.isArray(stored)) stored = {};
    var theme = stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'system';
    var dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    var accent = typeof stored.accent === 'string' && /^#[0-9a-f]{6}$/i.test(stored.accent)
      ? stored.accent.toLowerCase()
      : ${JSON.stringify(DEFAULT_PREFERENCES.accent)};
    root.style.setProperty('--accent-base', accent);
  }
  apply();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
})();`;

/** Persists and applies preferences immediately (same effect as the inline script). */
export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode, blocked); the choice still applies to this visit.
  }
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;
  root.classList.toggle('dark', resolveTheme(preferences.theme, prefersDark) === 'dark');
  root.style.setProperty('--accent-base', preferences.accent);
}
