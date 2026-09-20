import { buttonVariants } from '@septo/ui/components/button';
import { Skeleton } from '@septo/ui/components/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { ClientOnly, createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { NEW_NOTE_ID } from '../../../features/notes/domain/new-note';
import {
  getNotesGetQueryKey,
  getNotesGetQueryOptions,
} from '../../../shared/api/generated/endpoints/notes/notes';
import type { Note } from '../../../shared/api/generated/models';
import { EmptyState } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/notes/$noteId')({
  // Only warms the query cache (and turns a 404 into the not-found view): the editor starts from
  // the cache, not from loader data, which the router may hand back stale when a note is revisited.
  loader: async ({ context, params }) => {
    if (params.noteId === NEW_NOTE_ID) return;
    try {
      await context.queryClient.ensureQueryData(getNotesGetQueryOptions(params.noteId));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) throw notFound();
      throw error;
    }
  },
  notFoundComponent: NoteNotFound,
  component: NotePage,
});

function BackToList() {
  return (
    <Link
      to="/notes"
      search={(prev) => prev}
      className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} mb-4 md:hidden`}
    >
      <ArrowLeftIcon />
      Notas
    </Link>
  );
}

function NoteNotFound() {
  return (
    <div className="p-6 md:p-10">
      <BackToList />
      <EmptyState icon={ArrowLeftIcon} title="Nota não encontrada">
        Ela pode ter sido excluída. Escolha outra na lista.
      </EmptyState>
    </div>
  );
}

// The editor (Tiptap, ~200 KB) is its own chunk: `/notes` alone never downloads it.
const NoteEditor = lazy(() =>
  import('../../../features/notes/components/note-editor').then((m) => ({ default: m.NoteEditor })),
);

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Carregando o editor">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function NotePage() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();
  // Read from the cache, which the editor keeps current as the user types: leaving a note and
  // coming back must show what was typed, and a stale start would overwrite it on the next save.
  const queryClient = useQueryClient();
  const note =
    noteId === NEW_NOTE_ID
      ? null
      : (queryClient.getQueryData<Note>(getNotesGetQueryKey(noteId)) ?? null);

  // The editor is remounted when another note is opened, but not when a draft becomes its own
  // note: the URL changes from /notes/new to the new id while the user keeps typing.
  const [editorKey, setEditorKey] = useState(noteId);
  const [adopted, setAdopted] = useState<string>();
  if (noteId !== editorKey && noteId !== adopted) {
    setEditorKey(noteId);
    setAdopted(undefined);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <BackToList />
      <ClientOnly fallback={<EditorSkeleton />}>
        <Suspense fallback={<EditorSkeleton />}>
          {/* Never a draft for an id that exists: without its cached note, wait instead of creating. */}
          {note || noteId === NEW_NOTE_ID ? (
            <NoteEditor
              key={editorKey}
              note={note}
              onCreated={(id) => {
                setAdopted(id);
                navigate({
                  to: '/notes/$noteId',
                  params: { noteId: id },
                  search: (prev) => prev,
                  replace: true,
                });
              }}
            />
          ) : (
            <EditorSkeleton />
          )}
        </Suspense>
      </ClientOnly>
    </div>
  );
}
