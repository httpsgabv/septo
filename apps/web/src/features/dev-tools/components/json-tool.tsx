import { useMemo, useState } from 'react';
import { formatJson, type JsonIndent, type JsonOutcome, minifyJson } from '../domain/json';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { CopyButton } from './copy-button';
import { Segmented } from './segmented';
import { Pane, PaneTextarea, Workspace } from './workspace';

type Layout = JsonIndent | 'min';

const LAYOUTS: { value: Layout; label: string; title: string }[] = [
  { value: 2, label: '2', title: '2 espaços' },
  { value: 4, label: '4', title: '4 espaços' },
  { value: 'tab', label: 'Tab', title: 'Tabulação' },
  { value: 'min', label: 'Min', title: 'Minificar' },
];

export function JsonTool() {
  const [input, setInput] = useState('');
  const [layout, setLayout] = useState<Layout>(2);

  // ponytail: parses on every keystroke; useDeferredValue if a real 2 MB paste makes typing lag.
  const outcome: JsonOutcome = useMemo(() => {
    if (input.length > MAX_TEXT_CHARS) {
      return { ok: false, message: TEXT_TOO_LARGE, line: null, column: null };
    }
    return layout === 'min' ? minifyJson(input) : formatJson(input, layout);
  }, [input, layout]);

  const output = outcome.ok ? outcome.text : '';
  const problem = outcome.ok
    ? null
    : outcome.line === null
      ? outcome.message
      : `Linha ${outcome.line}, coluna ${outcome.column}: ${outcome.message}`;

  return (
    <Workspace
      to="/dev-tools/json"
      toolbar={
        <Segmented
          legend="Indentação"
          name="indent"
          value={layout}
          options={LAYOUTS}
          onChange={setLayout}
        />
      }
      error={problem}
    >
      <Pane label="Entrada" htmlFor="json-input">
        <PaneTextarea
          id="json-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-invalid={problem !== null}
          placeholder={'{ "cole": "o seu JSON aqui" }'}
        />
      </Pane>
      <Pane label="Saída" htmlFor="json-output" actions={<CopyButton value={output} />}>
        <PaneTextarea id="json-output" value={output} readOnly />
      </Pane>
    </Workspace>
  );
}
