import { Button, buttonVariants } from '@septo/ui/components/button';
import { EditorContent, useEditor } from '@tiptap/react';
import { Maximize2Icon, Minimize2Icon, UploadIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { markdownExtensions, parseMarkdown } from '../../../shared/markdown';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { FileDrop } from './file-drop';
import { LazyCodeEditor } from './lazy-code-editor';
import { Pane, Workspace } from './workspace';

const ACCEPT = '.md,.markdown,text/markdown,text/plain';

export function ReadmeTool() {
  const [markdown, setMarkdown] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Read-only Tiptap: the ProseMirror parser builds the document, so no HTML is ever injected.
  const editor = useEditor({
    extensions: markdownExtensions,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'markdown-content outline-none' } },
  });

  useEffect(() => {
    if (!editor) return;
    if (markdown.length > MAX_TEXT_CHARS) {
      setProblem(TEXT_TOO_LARGE);
      return;
    }
    try {
      editor.commands.setContent(parseMarkdown(markdown));
      setProblem(null);
    } catch {
      setProblem('Não deu para ler este markdown.');
    }
  }, [editor, markdown]);

  // Esc closes the expanded reading from anywhere on the page (the markdown editor is hidden then).
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  async function readFile(file: File): Promise<void> {
    setMarkdown(await file.text());
  }

  const drop = { accept: ACCEPT, maxBytes: MAX_TEXT_CHARS, tooLarge: TEXT_TOO_LARGE };

  return (
    <Workspace to="/dev-tools/readme" error={problem}>
      <Pane
        label="Markdown"
        labelId="readme-input-label"
        // Covered, not unmounted: the text and its undo history are there when the reading closes.
        className={expanded ? 'hidden' : undefined}
        actions={
          <FileDrop
            {...drop}
            onFile={readFile}
            onReject={setProblem}
            title="Abrir um .md"
            className={buttonVariants({ variant: 'ghost', size: 'xs' })}
          >
            <UploadIcon aria-hidden="true" />
            Arquivo
          </FileDrop>
        }
      >
        {/* The whole pane takes a dropped .md (the editor declines file drops); clicks stay with it. */}
        <FileDrop
          {...drop}
          pick={false}
          onFile={readFile}
          onReject={setProblem}
          className="absolute inset-0 data-over:bg-brand-subtle"
        >
          <LazyCodeEditor
            labelledBy="readme-input-label"
            value={markdown}
            onChange={setMarkdown}
            language="markdown"
            placeholder={'# Título\n\nCole ou solte um README.'}
            wrap
          />
        </FileDrop>
      </Pane>
      <Pane
        label="Leitura"
        // Expanded, the reading takes the writing pane's place too; sidebar, header and toolbar stay.
        className={expanded ? 'md:col-span-2' : undefined}
        actions={
          // One button that changes its label: focus stays on it when the pane opens and closes.
          <Button variant="ghost" size="xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
            {expanded ? 'Fechar' : 'Expandir'}
          </Button>
        }
      >
        <div className="absolute inset-0 overflow-y-auto px-4 py-3 md:px-6">
          <div className={expanded ? 'mx-auto max-w-3xl py-6' : undefined}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </Pane>
    </Workspace>
  );
}
