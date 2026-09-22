import { useMemo, useState } from 'react';
import {
  formatJson,
  type JsonIndent,
  type JsonOutcome,
  jsonDiagnostic,
  minifyJson,
} from '../domain/json';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { CopyButton } from './copy-button';
import { LazyCodeEditor } from './lazy-code-editor';
import { Segmented } from './segmented';
import { Pane, Workspace } from './workspace';

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

  // While the input is broken (every keystroke of hand-written JSON passes through that), the
  // output keeps the last valid result instead of blinking to empty. Adjusted during render, not
  // in an effect, so there is never a frame with the stale value. Empty input is valid: it clears.
  const [output, setOutput] = useState('');
  if (outcome.ok && outcome.text !== output) setOutput(outcome.text);
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
      <Pane label="Entrada" labelId="json-input-label">
        <LazyCodeEditor
          labelledBy="json-input-label"
          value={input}
          onChange={setInput}
          language="json"
          diagnose={jsonDiagnostic}
          placeholder={'{ "cole": "o seu JSON aqui" }'}
        />
      </Pane>
      <Pane label="Saída" labelId="json-output-label" actions={<CopyButton value={output} />}>
        <LazyCodeEditor labelledBy="json-output-label" value={output} language="json" readOnly />
      </Pane>
    </Workspace>
  );
}
