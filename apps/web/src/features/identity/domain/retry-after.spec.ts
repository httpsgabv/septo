import { describe, expect, it } from 'vitest';
import { describeWait } from './retry-after';

describe('describeWait', () => {
  it.each([
    [1, '1 segundo'],
    [45, '45 segundos'],
    [60, '1 minuto'],
    [61, '2 minutos'],
    [900, '15 minutos'],
  ])('%i s → %s', (seconds, expected) => {
    expect(describeWait(seconds)).toBe(expected);
  });

  it.each([undefined, '', 'abc', '-5', '0'])('falls back to a generic wait for %j', (value) => {
    expect(describeWait(value)).toBe('alguns minutos');
  });

  it('reads the header as text', () => {
    expect(describeWait('120')).toBe('2 minutos');
  });
});
