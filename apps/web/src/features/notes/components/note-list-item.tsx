import { Link } from '@tanstack/react-router';
import { BellIcon, PinIcon } from 'lucide-react';
import type { NoteSummary } from '../../../shared/api/generated/models';
import { LocalTime } from './local-time';
import { NoteActions } from './note-actions';

export function NoteListItem({ note }: { note: NoteSummary }) {
  return (
    // The note link stretches over the whole row (after:inset-0); the tag links sit above it, so a
    // tag is its own link instead of an anchor nested in an anchor.
    <li className="relative border-b hover:bg-muted/50 has-[a[data-status=active]]:bg-muted">
      <Link
        to="/notes/$noteId"
        params={{ noteId: note.id }}
        search={(prev) => prev}
        className="block px-4 pt-3 pb-1 outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div className="flex items-baseline gap-2">
          {note.pinned && (
            <PinIcon
              className="size-3.5 shrink-0 self-center text-brand-text"
              aria-label="Fixada"
            />
          )}
          <span
            className={`min-w-0 flex-1 truncate font-medium ${note.title ? '' : 'text-muted-foreground italic'}`}
          >
            {note.title || 'Sem título'}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            <LocalTime iso={note.updatedAt} />
          </span>
        </div>
        {note.excerpt && (
          <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted-foreground">
            {note.excerpt}
          </p>
        )}
      </Link>
      <div className="relative z-10 flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-2 text-xs">
        {note.remindAt && (
          <span className="inline-flex items-center gap-1 text-brand-text">
            <BellIcon className="size-3" aria-hidden="true" />
            <LocalTime iso={note.remindAt} withTime />
          </span>
        )}
        {note.tags.map((tag) => (
          <Link
            key={tag}
            to="."
            search={(prev) => ({ ...prev, tag })}
            aria-label={`Filtrar pela tag ${tag}`}
            className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground outline-none hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {tag}
          </Link>
        ))}
        <div className="ml-auto">
          <NoteActions note={note} />
        </div>
      </div>
    </li>
  );
}
