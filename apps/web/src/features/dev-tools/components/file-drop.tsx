import { cn } from '@septo/ui/lib/utils';
import { type ReactNode, useState } from 'react';

/**
 * Drop target that is also a real file input: clicking works, Tab + Enter works, dragging works.
 * The caller shapes it (a small header button, or a whole pane) and styles the drag state with
 * `data-over`. The size check lives here so no tool forgets it.
 */
export function FileDrop({
  accept,
  maxBytes,
  tooLarge,
  onFile,
  onReject,
  disabled = false,
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

  return (
    <label
      title={title}
      data-over={over || undefined}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files[0]);
      }}
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
