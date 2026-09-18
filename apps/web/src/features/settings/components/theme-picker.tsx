import { THEME_OPTIONS, type ThemePreference } from '../domain/preferences';

export function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference | undefined;
  onChange: (theme: ThemePreference) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Tema</legend>
      <div className="inline-flex rounded-lg border bg-muted p-0.5">
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
