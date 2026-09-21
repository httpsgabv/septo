import { Button } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { useQueryClient } from '@tanstack/react-query';
import { Selection } from '@tiptap/pm/state';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import {
  getNotesGetQueryKey,
  getNotesListQueryKey,
  notesCreate,
  notesUpdate,
  useNotesGet,
} from '../../../shared/api/generated/endpoints/notes/notes';
import { getTagsListQueryKey } from '../../../shared/api/generated/endpoints/tags/tags';
import type { Note, UpdateNoteRequest } from '../../../shared/api/generated/models';
import { markdownExtensions, parseMarkdown, serializeMarkdown } from '../../../shared/markdown';
import { Autosave, type AutosaveStatus } from '../domain/autosave';
import { EditorToolbar } from './editor-toolbar';
import { NoteActions } from './note-actions';
import { ReminderField } from './reminder-field';
import { TagInput } from './tag-input';

const TITLE_MAX_LENGTH = 200;
const BODY_MAX_LENGTH = 100_000;

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: '',
  dirty: 'Salvando…',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: '',
};

/** Synchronous, unlike `commands.focus`: keys typed right after Enter must not land in the title. */
function focusAtStart(editor: Editor) {
  editor.view.dom.focus();
  editor.view.dispatch(editor.state.tr.setSelection(Selection.atStart(editor.state.doc)));
}

type Props = {
  /** `null` is a draft: nothing exists on the server until the first save with content. */
  note: Note | null;
  /** Called once, when the draft becomes a real note; the route swaps the URL for its id. */
  onCreated?: (id: string) => void;
};

/**
 * Loaded on demand (see the note route). Owns what is being edited: `note` only seeds it, and the
 * route remounts the editor when another note is opened.
 */
export function NoteEditor({ note, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(note?.title ?? '');
  const [tags, setTags] = useState(note?.tags ?? []);
  const [remindAt, setRemindAt] = useState(note?.remindAt ?? null);
  const [savedId, setSavedId] = useState(note?.id ?? null);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [tooLong, setTooLong] = useState(false);
  // The cached note carries the pinned/archived flags; the editor's own state does not track them.
  // Never refetched here: a refetch could bring back a body older than what was just typed.
  const { data: savedNote } = useNotesGet(savedId ?? '', {
    query: {
      enabled: savedId !== null,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
    },
  });
  const [initialContent] = useState(() => parseMarkdown(note?.body ?? ''));

  // Everything typed so far: creating a draft sends all of it, not just the last patch.
  const current = useRef<UpdateNoteRequest>({
    title: note?.title ?? '',
    body: note?.body ?? '',
    tags: note?.tags ?? [],
    remindAt: note?.remindAt ?? null,
  });
  const noteId = useRef(note?.id ?? null);
  const mounted = useRef(true);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const [autosave] = useState(
    () =>
      new Autosave<UpdateNoteRequest>({
        onStatus: setStatus,
        save: async (patch) => {
          const listQuery = { queryKey: [getNotesListQueryKey()[0]] };
          if (noteId.current) {
            await notesUpdate(noteId.current, patch);
            // Only now: invalidating on every keystroke would make the note jump around the list.
            await queryClient.invalidateQueries(listQuery);
            if (patch.tags)
              await queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() });
            return 'saved';
          }
          const { title = '', body = '' } = current.current;
          if (!title.trim() && !body.trim()) return 'skipped';
          const created = await notesCreate(current.current);
          noteId.current = created.id;
          setSavedId(created.id);
          queryClient.setQueryData(getNotesGetQueryKey(created.id), created);
          await queryClient.invalidateQueries(listQuery);
          if (patch.tags) await queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() });
          // Not when the user already left: a late create must not pull them back to this note.
          if (mounted.current) onCreatedRef.current?.(created.id);
          return 'saved';
        },
      }),
  );

  /** Every edit goes through here: remembered, applied to the cached note, and queued to save. */
  function change(patch: UpdateNoteRequest) {
    current.current = { ...current.current, ...patch };
    if (noteId.current) {
      queryClient.setQueryData<Note>(getNotesGetQueryKey(noteId.current), (old) =>
        old ? { ...old, ...patch } : old,
      );
    }
    autosave.change(patch);
  }

  const editor = useEditor({
    extensions: markdownExtensions,
    content: initialContent,
    // Tiptap has no server rendering: the editor mounts on the client, the route shows a skeleton.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'note-content min-h-64 outline-none',
        // A contenteditable div is not announced as an editor unless it says so.
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Corpo da nota',
      },
    },
    onUpdate: ({ editor }) => {
      // ponytail: serializes on every update; debounce it if a 100k-character note feels slow
      const body = serializeMarkdown(editor.getJSON());
      const long = body.length > BODY_MAX_LENGTH;
      setTooLong(long);
      if (!long) change({ body });
    },
  });

  useEffect(() => {
    // React may run this effect again without recreating the state, so both ends are reversible.
    mounted.current = true;
    autosave.attach();
    const flushWhenHidden = () => {
      if (document.hidden) void autosave.flush();
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      // Leaving the note (or opening another) saves what was still waiting for the pause.
      mounted.current = false;
      void autosave.flush();
      autosave.detach();
    };
  }, [autosave]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            change({ title: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (editor) focusAtStart(editor);
            }
          }}
          aria-label="Título"
          placeholder="Título"
          maxLength={TITLE_MAX_LENGTH}
          autoFocus={!note}
          className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
        />
        <p role="status" className="shrink-0 text-sm text-muted-foreground">
          {STATUS_TEXT[status]}
        </p>
        <ReminderField
          value={remindAt}
          onChange={(next) => {
            setRemindAt(next);
            change({ remindAt: next });
          }}
        />
        {savedNote && <NoteActions note={savedNote} />}
      </div>
      {status === 'error' ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          Erro ao salvar
          <Button variant="outline" size="xs" onClick={() => autosave.retry()}>
            Tentar de novo
          </Button>
        </p>
      ) : (
        tooLong && (
          <p role="alert" className="text-sm text-destructive">
            A nota passou de 100.000 caracteres e não será salva enquanto não ficar menor.
          </p>
        )
      )}
      <TagInput
        value={tags}
        onChange={(next) => {
          setTags(next);
          change({ tags: next });
        }}
      />
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
