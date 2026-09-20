import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { BellIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { fromLocalInput, isPast, toLocalInput } from '../domain/remind-at';
import { LocalTime } from './local-time';

/** When to be reminded, in local time; the note stores it as an ISO instant. */
export function ReminderField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (remindAt: string | null) => void;
}) {
  // The field's own text: while a date is half typed the browser reports "", and a controlled
  // value derived from the note would wipe what is being typed.
  const [text, setText] = useState(toLocalInput(value));
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BellIcon className="size-4" aria-hidden="true" />
          Lembrete
        </label>
        <Input
          id={id}
          type="datetime-local"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(fromLocalInput(event.target.value));
          }}
          className="h-8 w-auto"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText('');
              onChange(null);
            }}
          >
            Limpar lembrete
          </Button>
        )}
      </div>
      {value && (
        <p role="status" className="text-sm text-muted-foreground">
          {isPast(value, new Date()) ? (
            <span className="text-destructive">Essa data já passou.</span>
          ) : (
            <>
              Lembrar em <LocalTime iso={value} withTime />
            </>
          )}
        </p>
      )}
    </div>
  );
}
