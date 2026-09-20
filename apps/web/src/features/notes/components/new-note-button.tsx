import { buttonVariants } from '@septo/ui/components/button';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { NEW_NOTE_ID } from '../domain/new-note';

export function NewNoteButton() {
  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: NEW_NOTE_ID }}
      search={(prev) => prev}
      className={buttonVariants({ size: 'sm' })}
    >
      <PlusIcon />
      Nova nota
    </Link>
  );
}
