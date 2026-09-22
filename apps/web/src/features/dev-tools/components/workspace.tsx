import { Skeleton } from '@septo/ui/components/skeleton';
import { Textarea } from '@septo/ui/components/textarea';
import { cn } from '@septo/ui/lib/utils';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
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
  expanded = false,
  onCollapse,
  children,
}: {
  label: string;
  /** The control the label names; without it the label is plain text. */
  htmlFor?: string;
  /** Id for the label, for a control that points at it with `aria-labelledby` (the code editor). */
  labelId?: string;
  actions?: ReactNode;
  /** Covers the whole window (not the browser's fullscreen) as a modal; Esc calls `onCollapse`. */
  expanded?: boolean;
  onCollapse?: () => void;
  children: ReactNode;
}) {
  const labelClass = 'text-xs font-medium tracking-wide text-muted-foreground uppercase';

  // Esc leaves; Tab cycles inside, since what is behind is covered and must not take focus.
  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCollapse?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  return (
    <section
      {...(expanded && { role: 'dialog', 'aria-modal': true, 'aria-label': label, onKeyDown })}
      className={cn(
        'flex min-h-72 min-w-0 flex-col md:min-h-0',
        expanded && 'fixed inset-0 z-50 min-h-0 bg-background',
      )}
    >
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

/** A textarea that fills its pane, with the pane itself as the border. */
export function PaneTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <Textarea
      spellCheck={false}
      className={cn(
        'absolute inset-0 size-full resize-none rounded-none border-0 bg-transparent px-4 py-3 font-mono text-xs shadow-none field-sizing-fixed focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-inset aria-invalid:ring-0 md:px-6 md:text-xs dark:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}
