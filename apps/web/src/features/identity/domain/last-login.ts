/** "19 de setembro de 2026 às 12:30" in the viewer's time zone, or "Nunca" before the first login. */
export function formatLastLogin(iso: string | null, timeZone?: string): string {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}
