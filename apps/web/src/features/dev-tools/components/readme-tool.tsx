import { buttonVariants } from '@septo/ui/components/button';
import { EditorContent, useEditor } from '@tiptap/react';
import { UploadIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { markdownExtensions, parseMarkdown } from '../../../shared/markdown';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { FileDrop } from './file-drop';
import { Pane, PaneTextarea, Workspace } from './workspace';

const ACCEPT = '.md,.markdown,text/markdown,text/plain';

export function ReadmeTool() {
  const [markdown, setMarkdown] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

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

  async function readFile(file: File): Promise<void> {
    setMarkdown(await file.text());
  }

  const drop = { accept: ACCEPT, maxBytes: MAX_TEXT_CHARS, tooLarge: TEXT_TOO_LARGE };

  return (
    <Workspace to="/dev-tools/readme" error={problem}>
      <Pane
        label="Markdown"
        htmlFor="readme-input"
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
        {/* The whole pane takes a dropped .md; clicks stay with the textarea. */}
        <FileDrop
          {...drop}
          pick={false}
          onFile={readFile}
          onReject={setProblem}
          className="absolute inset-0 data-over:bg-brand-subtle"
        >
          <PaneTextarea
            id="readme-input"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder={'# Título\n\nCole ou solte um README.'}
          />
        </FileDrop>
      </Pane>
      <Pane label="Leitura">
        <div className="absolute inset-0 overflow-y-auto px-4 py-3 md:px-6">
          <EditorContent editor={editor} />
        </div>
      </Pane>
    </Workspace>
  );
}
