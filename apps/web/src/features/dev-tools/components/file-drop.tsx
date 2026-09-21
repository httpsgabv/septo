import { UploadIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Drop area that is also a real file input: clicking works, Tab + Enter works, dragging works.
 * The size check lives here so no tool forgets it.
 */
export function FileDrop({
  label,
  accept,
  maxBytes,
  tooLarge,
  onFile,
  onReject,
  disabled = false,
}: {
  label: string;
  accept?: string;
  maxBytes: number;
  tooLarge: string;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
  disabled?: boolean;
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
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${
        over ? 'border-brand-text bg-brand-subtle' : 'hover:border-foreground/30'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
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
      <UploadIcon className="size-4 text-brand-text" aria-hidden="true" />
      {label}
    </label>
  );
}
