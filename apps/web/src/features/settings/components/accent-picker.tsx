import { cn } from '@septo/ui/lib/utils';
import { PipetteIcon } from 'lucide-react';
import { ACCENT_PRESETS } from '../domain/preferences';

const swatch =
  'relative flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background has-checked:ring-2 has-checked:ring-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring';

export function AccentPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (accent: string) => void;
}) {
  const isCustom = value !== undefined && !ACCENT_PRESETS.some((preset) => preset.value === value);

  return (
    <fieldset>
      <legend className="sr-only">Cor de destaque</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        {ACCENT_PRESETS.map((preset) => (
          <label
            key={preset.value}
            title={preset.name}
            className={swatch}
            style={{ backgroundColor: preset.value }}
          >
            <input
              type="radio"
              name="accent"
              value={preset.value}
              checked={value === preset.value}
              onChange={() => onChange(preset.value)}
              className="sr-only"
            />
            <span className="sr-only">{preset.name}</span>
          </label>
        ))}

        <label
          title="Cor personalizada"
          className={cn(swatch, 'border', isCustom && 'ring-2 ring-foreground')}
          style={isCustom ? { backgroundColor: value } : undefined}
        >
          <input
            type="color"
            value={value ?? ACCENT_PRESETS[0]?.value}
            onChange={(event) => onChange(event.target.value)}
            className="sr-only"
          />
          {!isCustom && (
            <PipetteIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">Cor personalizada</span>
        </label>
      </div>
    </fieldset>
  );
}
