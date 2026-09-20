const pad = (value: number) => String(value).padStart(2, '0');

/** ISO (UTC) to the value of `<input type="datetime-local">`: local time, minutes precision. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The value of the field (local time, no zone) to ISO; `null` when it is empty or unreadable. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  // A date-time without an offset is read as local time.
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Only a warning in the UI: the API accepts a reminder in the past. */
export function isPast(iso: string | null, now: Date): boolean {
  return iso !== null && new Date(iso).getTime() < now.getTime();
}
