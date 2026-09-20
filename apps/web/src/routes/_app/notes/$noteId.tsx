import { Button } from '@septo/ui/components/button';
import { Skeleton } from '@septo/ui/components/skeleton';
import { ClientOnly, createFileRoute, Link, notFound } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import {
  getNotesGetQueryOptions,
  useNotesGet,
} from '../../../shared/api/generated/endpoints/notes/notes';
import { EmptyState } from '../../../shared/layout/page';

export const Route = createFileRoute('/_app/notes/$noteId')({
  loader: async ({ context, params }) => {
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
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      className="mb-4 md:hidden"
      render={<Link to="/notes" search={(prev) => prev} />}
    >
      <ArrowLeftIcon />
      Notas
    </Button>
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
  const { data: note } = useNotesGet(noteId);
  if (!note) return null;

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <BackToList />
      <ClientOnly fallback={<EditorSkeleton />}>
        <Suspense fallback={<EditorSkeleton />}>
          <NoteEditor key={note.id} note={note} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
