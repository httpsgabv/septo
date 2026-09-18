import { useEffect, useState } from 'react';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  type Preferences,
  parsePreferences,
} from './domain/preferences';
import { savePreferences } from './preferences-script';

/** `null` until mounted: preferences live in the browser, so the server cannot know them. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PREFERENCES_KEY);
    } catch {
      // Blocked storage: defaults apply.
    }
    setPreferences(parsePreferences(raw));
  }, []);

  const update = (patch: Partial<Preferences>) => {
    const next = { ...(preferences ?? DEFAULT_PREFERENCES), ...patch };
    savePreferences(next);
    setPreferences(next);
  };

  return [preferences, update] as const;
}
