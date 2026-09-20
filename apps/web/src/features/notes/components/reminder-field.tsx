import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@septo/ui/components/popover';
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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={value ? 'secondary' : 'ghost'}
            size="icon-xs"
            aria-label="Abrir lembrete"
            title="Lembrete"
          />
        }
      >
        <BellIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          Lembrete
        </label>
        <div className="flex items-center gap-2">
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
      </PopoverContent>
    </Popover>
  );
}
