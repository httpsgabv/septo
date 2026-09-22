import { ArrowRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  convertData,
  type DataFormat,
  type DataOutcome,
  detectFormat,
  FORMAT_LABELS,
} from '../domain/data';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import type { CodeLanguage } from './code-editor';
import { CopyButton } from './copy-button';
import { LazyCodeEditor } from './lazy-code-editor';
import { Segmented } from './segmented';
import { Pane, Workspace } from './workspace';

const FORMATS: DataFormat[] = ['json', 'yaml', 'csv', 'xml'];
// CSV has no grammar worth coloring: plain text, and no parser to download.
const LANGUAGE: Record<DataFormat, CodeLanguage | null> = {
  json: 'json',
  yaml: 'yaml',
  csv: null,
  xml: 'xml',
};
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

  const formatOptions = FORMATS.map((format) => ({
    value: format,
    label: FORMAT_LABELS[format],
    title: format === 'xml' ? 'Conversão com perda: atributos viram @_nome' : undefined,
  }));

  return (
    <Workspace
      to="/dev-tools/data"
      toolbar={
        <>
          <Segmented
            legend="Formato de entrada"
            name="from"
            value={from}
            options={[
              {
                value: AUTO,
                label: detected ? `Detectar (${FORMAT_LABELS[detected]})` : 'Detectar',
              },
              ...formatOptions,
            ]}
            onChange={setFrom}
          />
          <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <Segmented
            legend="Formato de saída"
            name="to"
            value={to}
            options={formatOptions}
            onChange={setTo}
          />
        </>
      }
      error={outcome.ok ? null : outcome.message}
    >
      <Pane label="Entrada" labelId="data-input-label">
        <LazyCodeEditor
          labelledBy="data-input-label"
          value={input}
          onChange={setInput}
          language={source ? LANGUAGE[source] : null}
          placeholder={'nome: Gabriel\ntags:\n  - a'}
        />
      </Pane>
      <Pane label="Saída" labelId="data-output-label" actions={<CopyButton value={output} />}>
        <LazyCodeEditor
          labelledBy="data-output-label"
          value={output}
          language={LANGUAGE[to]}
          readOnly
        />
      </Pane>
    </Workspace>
  );
}
