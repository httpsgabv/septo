import { Button } from '@septo/ui/components/button';
import { Textarea } from '@septo/ui/components/textarea';
import { useState } from 'react';
import { formatJson, type JsonIndent, type JsonOutcome, minifyJson } from '../domain/json';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { CopyButton } from './copy-button';

const INDENTS: { value: JsonIndent; label: string }[] = [
  { value: 2, label: '2 espaços' },
  { value: 4, label: '4 espaços' },
  { value: 'tab', label: 'Tab' },
];

export function JsonTool() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [outcome, setOutcome] = useState<JsonOutcome | null>(null);

  function run(transform: (text: string) => JsonOutcome) {
    if (input.length > MAX_TEXT_CHARS) {
      setOutcome({ ok: false, message: TEXT_TOO_LARGE, line: null, column: null });
      return;
    }
    setOutcome(transform(input));
  }

  const output = outcome?.ok ? outcome.text : '';
  const problem = outcome && !outcome.ok ? outcome : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset>
          <legend className="sr-only">Indentação</legend>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {INDENTS.map((option) => (
              <label
                key={option.label}
                className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="indent"
                  value={String(option.value)}
                  checked={indent === option.value}
                  onChange={() => setIndent(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button onClick={() => run((text) => formatJson(text, indent))}>Formatar</Button>
        <Button variant="outline" onClick={() => run(minifyJson)}>
          Minificar
        </Button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {problem && (
          <span className="text-destructive">
            {problem.line === null
              ? problem.message
              : `Linha ${problem.line}, coluna ${problem.column}: ${problem.message}`}
          </span>
        )}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="json-input" className="text-sm font-medium">
            Entrada
          </label>
          <Textarea
            id="json-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            aria-invalid={problem !== null}
            placeholder={'{ "cole": "o seu JSON aqui" }'}
            className="h-96 field-sizing-fixed font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="json-output" className="text-sm font-medium">
              Saída
            </label>
            <CopyButton value={output} />
          </div>
          <Textarea
            id="json-output"
            value={output}
            readOnly
            spellCheck={false}
            className="h-96 field-sizing-fixed font-mono text-xs"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Números inteiros acima de 2<sup>53</sup> voltam arredondados: é o limite do próprio{' '}
        <code>JSON.parse</code> do navegador.
      </p>
    </div>
  );
}
