import { Skeleton } from '@septo/ui/components/skeleton';
import { cn } from '@septo/ui/lib/utils';
import type { ReactNode } from 'react';
import { type Tool, toolFor } from '../domain/tools';

/**
 * Frame shared by the six tools: a toolbar (name on the left, the tool's own controls on the
 * right), the panes filling the rest of the window from `md` up, and a status bar that only shows
 * when there is something to say. The tool renders it, because the controls live in its state.
 * With no children it is the skeleton a lazy tool shows while its chunk loads.
 */
export function Workspace({
  to,
  toolbar,
  error,
  info,
  children,
}: {
  to: Tool['to'];
  toolbar?: ReactNode;
  error?: string | null;
  info?: ReactNode;
  children?: ReactNode;
}) {
  const tool = toolFor(to);
  const Icon = tool.icon;

  return (
    <div className="flex flex-col md:h-[calc(100dvh-3rem)]">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 md:px-6">
        <h1 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-brand-text" aria-hidden="true" />
          {tool.label}
        </h1>
        {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
      </header>

      <div className="grid min-h-0 flex-1 max-md:divide-y md:grid-cols-2 md:divide-x">
        {children ?? (
          <>
            <Skeleton className="m-4 min-h-64" />
            <Skeleton className="m-4 min-h-64" />
          </>
        )}
      </div>

      {/* Always mounted, so screen readers announce what appears in it. */}
      <div
        aria-live="polite"
        className={cn(
          'flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-4 border-t px-4 py-1 text-xs md:px-6',
          !error && !info && 'hidden',
        )}
      >
        {error && <span className="text-destructive">{error}</span>}
        {info && <span className="ml-auto text-muted-foreground tabular-nums">{info}</span>}
      </div>
    </div>
  );
}

/** One side of a workspace: a slim header (label + actions) over a borderless body. */
export function Pane({
  label,
  htmlFor,
  labelId,
  actions,
  className,
  children,
}: {
  label: string;
  /** The control the label names; without it the label is plain text. */
  htmlFor?: string;
  /** Id for the label, for a control that points at it with `aria-labelledby` (the code editor). */
  labelId?: string;
  actions?: ReactNode;
  /** Layout overrides, e.g. spanning both columns or leaving the grid. */
  className?: string;
  children: ReactNode;
}) {
  const labelClass = 'text-xs font-medium tracking-wide text-muted-foreground uppercase';
  return (
    <section className={cn('flex min-h-72 min-w-0 flex-col md:min-h-0', className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6">
        {htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <span id={labelId} className={labelClass}>
            {label}
          </span>
        )}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}
