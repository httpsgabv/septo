import { afterEach, describe, expect, it } from 'vitest';
import { fromLocalInput, isPast, toLocalInput } from './remind-at';

const originalTz = process.env.TZ;
const inZone = (tz: string) => {
  process.env.TZ = tz;
};
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

// <input type="datetime-local"> speaks local time without a zone; the API speaks ISO in UTC.
describe.each([
  ['America/Sao_Paulo', '2030-01-01T09:00', '2030-01-01T12:00:00.000Z'], // UTC-3, no DST
  ['Europe/Lisbon', '2030-07-01T09:00', '2030-07-01T08:00:00.000Z'], // summer time, UTC+1
  ['Europe/Lisbon', '2030-01-01T09:00', '2030-01-01T09:00:00.000Z'], // winter time, UTC+0
  ['Asia/Tokyo', '2030-01-01T09:00', '2030-01-01T00:00:00.000Z'], // UTC+9
])('in %s', (tz, local, iso) => {
  it(`reads ${local} as ${iso}`, () => {
    inZone(tz);
    expect(fromLocalInput(local)).toBe(iso);
  });

  it(`shows ${iso} as ${local}`, () => {
    inZone(tz);
    expect(toLocalInput(iso)).toBe(local);
  });
});

describe('fromLocalInput', () => {
  it.each(['', 'abc', '2030-13-45T99:99'])('gives null for %j (cleared or unreadable)', (value) => {
    expect(fromLocalInput(value)).toBeNull();
  });
});

describe('toLocalInput', () => {
  it('is empty without a reminder', () => {
    expect(toLocalInput(null)).toBe('');
  });

  it('drops seconds and milliseconds, which the field cannot show', () => {
    inZone('UTC');
    expect(toLocalInput('2030-01-01T09:00:59.999Z')).toBe('2030-01-01T09:00');
  });

  it('pads single digits', () => {
    inZone('UTC');
    expect(toLocalInput('2030-03-04T05:06:00.000Z')).toBe('2030-03-04T05:06');
  });

  it('round-trips through the field without drifting', () => {
    inZone('America/Sao_Paulo');
    const iso = '2030-06-15T18:45:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });
});

describe('isPast', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('is true before now, false at or after it', () => {
    expect(isPast('2026-09-20T11:59:59.000Z', now)).toBe(true);
    expect(isPast('2026-09-20T12:00:00.000Z', now)).toBe(false);
    expect(isPast('2026-09-20T12:00:01.000Z', now)).toBe(false);
  });

  it('is false without a reminder', () => {
    expect(isPast(null, now)).toBe(false);
  });
});
