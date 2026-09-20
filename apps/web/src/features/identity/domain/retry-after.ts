/** Turns a `Retry-After` value (seconds, as sent by the API) into text for the login error. */
export function describeWait(retryAfter: string | number | undefined): string {
  const seconds = Number(retryAfter);
  if (retryAfter === '' || !Number.isFinite(seconds) || seconds < 1) return 'alguns minutos';
  if (seconds < 60) return `${Math.ceil(seconds)} ${seconds <= 1 ? 'segundo' : 'segundos'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}
