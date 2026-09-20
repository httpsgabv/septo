import { Button } from '@septo/ui/components/button';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon } from 'lucide-react';
import { LocalTime } from '../../../features/notes/components/local-time';
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

// Placeholder until the editor arrives (T9): the note as plain text.
function NotePage() {
  const { noteId } = Route.useParams();
  const { data: note } = useNotesGet(noteId);
  if (!note) return null;

  return (
    <article className="p-6 md:p-10">
      <BackToList />
      <h2 className="text-xl font-semibold">{note.title || 'Sem título'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Editada em <LocalTime iso={note.updatedAt} withTime />
      </p>
      <pre className="mt-6 font-sans whitespace-pre-wrap">{note.body}</pre>
    </article>
  );
}
