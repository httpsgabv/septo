import { useSyncExternalStore } from 'react';

const noop = () => () => {};

function format(iso: string, withTime: boolean, timeZone?: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(!sameYear && { year: 'numeric' }),
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
    timeZone,
  }).format(date);
}

/**
 * A date in the reader's time zone. The server does not know it, so it renders in UTC and the
 * client corrects it after hydration (the same trick as the shortcut label in the header).
 */
export function LocalTime({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    noop,
    () => format(iso, withTime),
    () => format(iso, withTime, 'UTC'),
  );
  return <time dateTime={iso}>{text}</time>;
}
