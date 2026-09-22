import { ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import type { CodeEditorProps } from './code-editor';

// CodeMirror needs the DOM and is its own chunk: the index and the image tool never download it.
const CodeEditor = lazy(() => import('./code-editor').then((m) => ({ default: m.CodeEditor })));

/**
 * The editor the tools use. Until CodeMirror arrives (and on the server) the pane shows the same
 * text in a `<pre>`, so the first paint is neither empty nor a different size.
 */
export function LazyCodeEditor(props: CodeEditorProps) {
  const fallback = (
    // Unlabelled on purpose: nothing should type into it, so tests and screen readers wait for the editor.
    <pre
      className={`absolute inset-0 overflow-auto px-4 py-3 font-mono text-xs leading-[1.6] whitespace-pre md:px-6 ${props.value ? '' : 'text-muted-foreground'}`}
    >
      {props.value || props.placeholder}
    </pre>
  );
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <CodeEditor {...props} />
      </Suspense>
    </ClientOnly>
  );
}
