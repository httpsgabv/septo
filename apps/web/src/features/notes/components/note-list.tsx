import { Button, buttonVariants } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { Skeleton } from '@septo/ui/components/skeleton';
import { keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { NotebookPenIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNotesList } from '../../../shared/api/generated/endpoints/notes/notes';
import { EmptyState } from '../../../shared/layout/page';
import { NOTES_VIEWS, type NotesView, toListParams } from '../domain/search-params';
import { NewNoteButton } from './new-note-button';
import { NoteListItem } from './note-list-item';

const VIEW_LABELS: Record<NotesView, string> = {
  active: 'Ativas',
  reminders: 'Lembretes',
  archived: 'Arquivadas',
};

const EMPTY_TEXT: Record<NotesView, string> = {
  active: 'Nenhuma nota ainda.',
  reminders: 'Nenhuma nota com lembrete.',
  archived: 'Nenhuma nota arquivada.',
};

export function NoteList() {
  const search = useSearch({ from: '/_app/notes' });
  const view = search.view ?? 'active';
  const {
    data: notes,
    isPending,
    isError,
    refetch,
  } = useNotesList(toListParams(search), {
    query: { placeholderData: keepPreviousData },
  });
  const filtered = Boolean(search.q || search.tag);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Notas</h1>
          <NewNoteButton />
        </div>
        <SearchField />
        <nav aria-label="Filtro das notas" className="flex gap-1">
          {NOTES_VIEWS.map((option) => (
            <Link
              key={option}
              to="."
              // The default view stays out of the URL.
              search={(prev) => ({ ...prev, view: option === 'active' ? undefined : option })}
              aria-current={option === view ? 'true' : undefined}
              className={buttonVariants({
                variant: option === view ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              {VIEW_LABELS[option]}
            </Link>
          ))}
        </nav>
        {search.tag && (
          <Link
            to="."
            search={(prev) => ({ ...prev, tag: undefined })}
            aria-label={`Limpar o filtro da tag ${search.tag}`}
            className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-subtle py-0.5 pr-1.5 pl-2.5 text-sm text-brand-text outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {search.tag}
            <XIcon className="size-3" aria-hidden="true" />
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="flex flex-col gap-3 p-4" role="status" aria-label="Carregando notas">
            {['a', 'b', 'c', 'd'].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4" role="alert">
            <p className="text-sm text-destructive">Não foi possível carregar as notas.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : notes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={NotebookPenIcon}
              title={filtered ? 'Nada encontrado' : EMPTY_TEXT[view]}
            >
              {filtered
                ? 'Nenhuma nota bate com a busca ou a tag escolhida.'
                : 'As notas que você criar aparecem aqui.'}
            </EmptyState>
          </div>
        ) : (
          <ul aria-label="Notas">
            {notes.map((note) => (
              <NoteListItem key={note.id} note={note} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Writes `?q=` after a pause, replacing the history entry so typing does not pile up back steps. */
function SearchField() {
  const navigate = useNavigate();
  const { q } = useSearch({ from: '/_app/notes' });
  const [value, setValue] = useState(q ?? '');
  // The last value this field put in the URL: an echo of it must not overwrite what is being typed.
  const pushed = useRef(q ?? '');

  useEffect(() => {
    if ((q ?? '') !== pushed.current) {
      pushed.current = q ?? '';
      setValue(q ?? '');
    }
  }, [q]);

  useEffect(() => {
    if (value === pushed.current) return;
    const timer = setTimeout(() => {
      pushed.current = value;
      navigate({
        to: '.',
        search: (prev) => ({ ...prev, q: value.trim() ? value : undefined }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, navigate]);

  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Buscar notas"
        placeholder="Buscar notas…"
        maxLength={200}
        className="pl-8"
      />
    </div>
  );
}
