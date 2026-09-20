import { Input } from '@septo/ui/components/input';
import { EditorContent, useEditor } from '@tiptap/react';
import { useState } from 'react';
import type { Note } from '../../../shared/api/generated/models';
import { noteExtensions, parseMarkdown } from '../domain/markdown';
import { EditorToolbar } from './editor-toolbar';

/** Loaded on demand (see the note route): the Tiptap bundle stays out of the list route. */
export function NoteEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [initialContent] = useState(() => parseMarkdown(note.body));
  const editor = useEditor({
    extensions: noteExtensions,
    content: initialContent,
    // Tiptap has no server rendering: the editor mounts on the client, the route shows a skeleton.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'note-content min-h-64 outline-none', 'aria-label': 'Corpo da nota' },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Título"
        placeholder="Título"
        maxLength={200}
        className="h-auto border-0 bg-transparent px-0 py-1 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
      />
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
