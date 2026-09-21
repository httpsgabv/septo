import { cn } from '@septo/ui/lib/utils';
import { type DragEvent, type ReactNode, useState } from 'react';

/**
 * Drop target that is also a real file input: clicking works, Tab + Enter works, dragging works.
 * The caller shapes it (a small header button, or a whole pane) and styles the drag state with
 * `data-over`. With `pick={false}` it only takes drops, for wrapping a control that must keep its
 * own clicks (a textarea). The size check lives here so no tool forgets it.
 */
export function FileDrop({
  accept,
  maxBytes,
  tooLarge,
  onFile,
  onReject,
  disabled = false,
  pick = true,
  title,
  className,
  children,
}: {
  accept?: string;
  maxBytes: number;
  tooLarge: string;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
  disabled?: boolean;
  pick?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);

  function take(file: File | undefined): void {
    if (!file) return;
    if (file.size > maxBytes) {
      onReject(tooLarge);
      return;
    }
    onFile(file);
  }

  const dropProps = {
    title,
    'data-over': over || undefined,
    onDragOver: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      setOver(false);
      take(event.dataTransfer.files[0]);
    },
  };

  if (!pick) {
    return (
      <div {...dropProps} className={className}>
        {children}
      </div>
    );
  }

  return (
    <label
      {...dropProps}
      className={cn(
        'cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-ring',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = ''; // so choosing the same file twice still fires
        }}
      />
      {children}
    </label>
  );
}
