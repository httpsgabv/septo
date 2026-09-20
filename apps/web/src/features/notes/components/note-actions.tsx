import { Button } from '@septo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@septo/ui/components/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import {
  getNotesGetQueryKey,
  getNotesListQueryKey,
  useNotesArchive,
  useNotesDelete,
  useNotesPin,
  useNotesUnarchive,
  useNotesUnpin,
} from '../../../shared/api/generated/endpoints/notes/notes';
import { getTagsListQueryKey } from '../../../shared/api/generated/endpoints/tags/tags';
import type { Note } from '../../../shared/api/generated/models';
import { DeleteNoteDialog } from './delete-note-dialog';

/** Pin, archive and delete, for a row of the list and for the open note alike. */
export function NoteActions({
  note,
}: {
  note: Pick<Note, 'id' | 'title' | 'pinned' | 'archived'>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const isOpen = useParams({ strict: false }).noteId === note.id;

  /** Only the flags of the cached note: it may hold edits the server has not seen yet. */
  async function refresh(updated?: Note) {
    if (updated) {
      queryClient.setQueryData<Note>(getNotesGetQueryKey(note.id), (old) =>
        old ? { ...old, pinned: updated.pinned, archived: updated.archived } : old,
      );
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [getNotesListQueryKey()[0]] }),
      // Archiving moves a note's tags out of (or back into) the suggestions.
      queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() }),
    ]);
  }
  // The open note leaves the list it was opened from: back to the list, keeping the filters.
  const leave = () => navigate({ to: '/notes', search: (prev) => prev });

  const pin = useNotesPin({ mutation: { onSuccess: refresh } });
  const unpin = useNotesUnpin({ mutation: { onSuccess: refresh } });
  const unarchive = useNotesUnarchive({ mutation: { onSuccess: refresh } });
  const archive = useNotesArchive({
    mutation: {
      onSuccess: async (updated) => {
        await refresh(updated);
        if (isOpen) leave();
      },
    },
  });
  const remove = useNotesDelete({
    mutation: {
      onSuccess: async () => {
        queryClient.removeQueries({ queryKey: getNotesGetQueryKey(note.id) });
        await refresh();
        setConfirming(false);
        if (isOpen) leave();
      },
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Ações da nota ${note.title || 'sem título'}`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => (note.pinned ? unpin : pin).mutate({ id: note.id })}>
            {note.pinned ? <PinOffIcon /> : <PinIcon />}
            {note.pinned ? 'Desafixar' : 'Fixar'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => (note.archived ? unarchive : archive).mutate({ id: note.id })}
          >
            {note.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            {note.archived ? 'Desarquivar' : 'Arquivar'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteNoteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={note.title}
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ id: note.id })}
      />
    </>
  );
}
