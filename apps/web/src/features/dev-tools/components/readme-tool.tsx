import { Textarea } from '@septo/ui/components/textarea';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { markdownExtensions, parseMarkdown } from '../../../shared/markdown';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { FileDrop } from './file-drop';

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

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="min-h-5 text-sm">
        {problem && <span className="text-destructive">{problem}</span>}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="readme-input" className="text-sm font-medium">
            Markdown
          </label>
          <Textarea
            id="readme-input"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            spellCheck={false}
            placeholder={'# Título\n\nCole aqui o conteúdo de um README.'}
            className="h-[28rem] field-sizing-fixed font-mono text-xs"
          />
          <FileDrop
            accept=".md,.markdown,text/markdown,text/plain"
            maxBytes={MAX_TEXT_CHARS}
            tooLarge={TEXT_TOO_LARGE}
            onFile={readFile}
            onReject={setProblem}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground data-over:border-brand-text data-over:bg-brand-subtle"
          >
            Arraste um .md ou clique para escolher
          </FileDrop>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Leitura</p>
          <div className="h-[28rem] overflow-y-auto rounded-lg border px-4 py-3">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostra o mesmo conjunto de formatação do editor de notas: tabela, checklist e imagem
        aparecem como texto.
      </p>
    </div>
  );
}
