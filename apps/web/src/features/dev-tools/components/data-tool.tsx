import { Textarea } from '@septo/ui/components/textarea';
import { useMemo, useState } from 'react';
import {
  convertData,
  type DataFormat,
  type DataOutcome,
  detectFormat,
  FORMAT_LABELS,
} from '../domain/data';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { CopyButton } from './copy-button';

const FORMATS: DataFormat[] = ['json', 'yaml', 'csv', 'xml'];
const AUTO = 'auto';

export function DataTool() {
  const [input, setInput] = useState('');
  const [from, setFrom] = useState<DataFormat | typeof AUTO>(AUTO);
  const [to, setTo] = useState<DataFormat>('json');

  const detected = useMemo(() => detectFormat(input), [input]);
  const source = from === AUTO ? detected : from;

  const outcome: DataOutcome = useMemo(() => {
    if (!input.trim()) return { ok: true, text: '' };
    if (input.length > MAX_TEXT_CHARS) return { ok: false, message: TEXT_TOO_LARGE };
    if (!source) {
      return { ok: false, message: 'Não deu para reconhecer o formato: escolha um ao lado.' };
    }
    return convertData(input, source, to);
  }, [input, source, to]);

  const output = outcome.ok ? outcome.text : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Picker
          legend="Formato de entrada"
          name="from"
          value={from}
          options={[
            { value: AUTO, label: detected ? `Detectar (${FORMAT_LABELS[detected]})` : 'Detectar' },
            ...FORMATS.map((format) => ({ value: format, label: FORMAT_LABELS[format] })),
          ]}
          onChange={setFrom}
        />
        <span className="text-muted-foreground">→</span>
        <Picker
          legend="Formato de saída"
          name="to"
          value={to}
          options={FORMATS.map((format) => ({ value: format, label: FORMAT_LABELS[format] }))}
          onChange={setTo}
        />
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {!outcome.ok && <span className="text-destructive">{outcome.message}</span>}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="data-input" className="text-sm font-medium">
            Entrada
          </label>
          <Textarea
            id="data-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            aria-invalid={!outcome.ok}
            placeholder={'nome: Gabriel\ntags:\n  - a'}
            className="h-96 field-sizing-fixed font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="data-output" className="text-sm font-medium">
              Saída
            </label>
            <CopyButton value={output} />
          </div>
          <Textarea
            id="data-output"
            value={output}
            readOnly
            spellCheck={false}
            className="h-96 field-sizing-fixed font-mono text-xs"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        CSV descreve uma lista de objetos simples; XML é conversão com perda (atributos viram{' '}
        <code>@_nome</code> e os tipos são adivinhados na volta).
      </p>
    </div>
  );
}

function Picker<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-lg border bg-muted p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name={name}
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
