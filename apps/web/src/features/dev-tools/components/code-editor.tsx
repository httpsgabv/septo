import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { linter } from '@codemirror/lint';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import {
  Annotation,
  Compartment,
  EditorState,
  type Extension,
  Transaction,
} from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import './code-editor.css';

export type CodeLanguage = 'json' | 'yaml' | 'xml' | 'markdown';
export type CodeDiagnostic = { from: number; to: number; message: string };

export type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** `null` is plain text: no parser is downloaded. */
  language?: CodeLanguage | null;
  /** Id of the pane label that names the editor (a `<label for>` cannot name a contenteditable). */
  labelledBy: string;
  placeholder?: string;
  /** Soft-wrap long lines (prose, base64) instead of scrolling sideways. Read once, at creation. */
  wrap?: boolean;
  /** Must be stable (a module-level function): a new one reconfigures the linter. */
  diagnose?: (text: string) => CodeDiagnostic | null;
};

/** Marks the document swaps that come from the `value` prop, so they are not echoed to `onChange`. */
const external = Annotation.define<boolean>();

// Each parser is its own chunk: plain-text editors (encodings, RSA) never download one.
const LANGUAGES: Record<CodeLanguage, () => Promise<Extension>> = {
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  xml: () => import('@codemirror/lang-xml').then((m) => m.xml()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
};

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '0.75rem', color: 'var(--foreground)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { padding: '0.75rem 0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 1rem 0 0.5rem' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
    border: 'none',
    paddingLeft: '0.5rem',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--foreground) 4%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  // Only the editor being typed in marks its line; an idle pane (or a read-only output) stays flat.
  '&:not(.cm-focused) .cm-activeLine': { backgroundColor: 'transparent' },
  '&:not(.cm-focused) .cm-activeLineGutter': { color: 'var(--muted-foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    { backgroundColor: 'var(--brand-subtle)' },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in oklch, var(--brand-text) 12%, transparent)',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'transparent',
    outline: '1px solid color-mix(in oklch, var(--brand-text) 60%, transparent)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--muted)',
    border: 'none',
    color: 'var(--muted-foreground)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-panels': {
    backgroundColor: 'var(--popover)',
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
  },
});

const highlight = HighlightStyle.define([
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--code-property)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--code-number)' },
  { tag: [tags.keyword, tags.meta, tags.processingInstruction], color: 'var(--code-keyword)' },
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--code-tag)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--muted-foreground)' },
  { tag: tags.comment, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: tags.heading, fontWeight: '600', color: 'var(--code-property)' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--code-tag)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--code-string)' },
]);

/**
 * CodeMirror 6 with what makes pasting and tweaking data comfortable: line numbers, folding,
 * brackets, search, and Tab that indents. Esc then Tab leaves the editor (CodeMirror's own escape
 * hatch), so the keyboard is never trapped. Import it through `LazyCodeEditor`: it needs the DOM.
 */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  language = null,
  labelledBy,
  placeholder,
  wrap = false,
  diagnose,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const parts = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    lint: new Compartment(),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Created once; every later prop change goes through a transaction in the effects below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the view must not be recreated per prop.
  useEffect(() => {
    if (!host.current) return;
    const { language: lang, readOnly: ro, lint } = parts.current;
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          search({ top: true }),
          syntaxHighlighting(highlight),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          theme,
          placeholder ? placeholderText(placeholder) : [],
          wrap ? EditorView.lineWrapping : [],
          EditorView.contentAttributes.of({ 'aria-labelledby': labelledBy }),
          // A dropped file is the pane's business (size check, replace the whole text); without
          // this CodeMirror would also insert it at the cursor.
          EditorView.domEventHandlers({
            drop: (event) => Boolean(event.dataTransfer?.files.length),
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((tr) => tr.annotation(external))) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          }),
          lang.of([]),
          ro.of(readOnlyExtension(readOnly)),
          lint.of([]),
        ],
      }),
    });
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
  }, []);

  // Outside changes (a conversion result, "Inverter", a dropped file) replace the document without
  // entering the undo history, and only when it actually differs, so typing never loses the cursor.
  useEffect(() => {
    const current = view.current;
    if (!current || current.state.doc.toString() === value) return;
    current.dispatch({
      changes: { from: 0, to: current.state.doc.length, insert: value },
      annotations: [external.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: parts.current.readOnly.reconfigure(readOnlyExtension(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    let alive = true;
    const { language: lang } = parts.current;
    if (!language) {
      view.current?.dispatch({ effects: lang.reconfigure([]) });
    } else {
      LANGUAGES[language]().then((extension) => {
        if (alive) view.current?.dispatch({ effects: lang.reconfigure(extension) });
      });
    }
    return () => {
      alive = false;
    };
  }, [language]);

  useEffect(() => {
    const extension = diagnose
      ? linter(
          (current) => {
            const found = diagnose(current.state.doc.toString());
            return found ? [{ ...found, severity: 'error' as const }] : [];
          },
          { delay: 150 },
        )
      : [];
    view.current?.dispatch({ effects: parts.current.lint.reconfigure(extension) });
  }, [diagnose]);

  return <div ref={host} className="absolute inset-0" />;
}

function readOnlyExtension(readOnly: boolean): Extension {
  return readOnly
    ? [EditorState.readOnly.of(true), EditorView.contentAttributes.of({ 'aria-readonly': 'true' })]
    : [];
}
