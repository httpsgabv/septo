import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { NoteList } from '../../features/notes/components/note-list';
import { notesSearchSchema, toListParams } from '../../features/notes/domain/search-params';
import { getNotesListQueryOptions } from '../../shared/api/generated/endpoints/notes/notes';

/** Two columns: the list on the left (SSR), the open note on the right. */
export const Route = createFileRoute('/_app/notes')({
  head: () => ({ meta: [{ title: 'Notas · septo' }] }),
  validateSearch: notesSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    // prefetch (not ensure): a failing API is shown by the list, not by the route error page.
    await context.queryClient.prefetchQuery(getNotesListQueryOptions(toListParams(deps.search)));
  },
  component: NotesLayout,
});

function NotesLayout() {
  const { pathname } = useLocation();
  const noteOpen = pathname.replace(/\/$/, '') !== '/notes';

  // Narrow screens show one column at a time: the list, or the open note.
  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0">
      <section
        aria-label="Lista de notas"
        className={`min-h-0 w-full flex-col border-r md:flex md:w-80 md:shrink-0 lg:w-96 ${noteOpen ? 'hidden' : 'flex'}`}
      >
        <NoteList />
      </section>
      <div
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto md:block ${noteOpen ? 'block' : 'hidden'}`}
      >
        <Outlet />
      </div>
    </div>
  );
}
