import { Input } from '@septo/ui/components/input';
import { XIcon } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';
import { useTagsList } from '../../../shared/api/generated/endpoints/tags/tags';
import { addTags, MAX_TAGS } from '../domain/tags';

/** Tags as removable chips; typing (Enter, comma or leaving the field) adds, the datalist suggests. */
export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const { data: known = [] } = useTagsList();
  const listId = useId();
  const errorId = useId();
  const full = value.length >= MAX_TAGS;

  function commit(input: string) {
    if (!input.trim()) return;
    const result = addTags(value, input);
    setError(result.error);
    if (result.tags.length !== value.length) onChange(result.tags);
    // A rejected tag stays in the field to be corrected; anything accepted clears it.
    if (!result.error || result.tags.length !== value.length) setText('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(text);
    } else if (event.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length > 0 && (
          <ul aria-label="Tags da nota" className="contents">
            {value.map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-sm"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remover a tag ${tag}`}
                  onClick={() => onChange(value.filter((other) => other !== tag))}
                  className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Input
          value={text}
          onChange={(event) => {
            setError(undefined);
            // A comma (typed or pasted in a list) adds right away.
            if (event.target.value.includes(',')) commit(event.target.value);
            else setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(text)}
          list={listId}
          disabled={full}
          aria-label="Adicionar tag"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={full ? `Limite de ${MAX_TAGS} tags` : 'Adicionar tag…'}
          maxLength={100}
          autoComplete="off"
          className="h-7 w-44 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <datalist id={listId}>
          {known
            .filter((tag) => !value.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
