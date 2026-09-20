import { describe, expect, it } from 'vitest';
import { formatLastLogin } from './last-login';

describe('formatLastLogin', () => {
  it('says "Nunca" when there is no login yet', () => {
    expect(formatLastLogin(null)).toBe('Nunca');
  });

  it('formats date and time in pt-BR, in the given time zone', () => {
    const text = formatLastLogin('2026-09-19T12:30:00.000Z', 'UTC');

    expect(text).toContain('19 de setembro de 2026');
    expect(text).toContain('12:30');
  });

  it('follows the time zone: the same instant reads differently in São Paulo', () => {
    expect(formatLastLogin('2026-09-19T12:30:00.000Z', 'America/Sao_Paulo')).toContain('09:30');
  });
});
