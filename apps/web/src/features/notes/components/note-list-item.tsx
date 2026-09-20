import { Link } from '@tanstack/react-router';
import { BellIcon, PinIcon } from 'lucide-react';
import type { NoteSummary } from '../../../shared/api/generated/models';
import { LocalTime } from './local-time';

export function NoteListItem({ note }: { note: NoteSummary }) {
  return (
    <li className="border-b">
      <Link
        to="/notes/$noteId"
        params={{ noteId: note.id }}
        search={(prev) => prev}
        className="block px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-[status=active]:bg-muted"
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
        {(note.tags.length > 0 || note.remindAt) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {note.remindAt && (
              <span className="inline-flex items-center gap-1 text-brand-text">
                <BellIcon className="size-3" aria-hidden="true" />
                <LocalTime iso={note.remindAt} withTime />
              </span>
            )}
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </li>
  );
}
