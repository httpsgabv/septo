import { describe, expect, it } from 'vitest';
import {
  decodeText,
  type EncodingScheme,
  encodeBytes,
  encodeText,
  SCHEMES_FOR_BYTES,
} from './encoding';

const TRICKY = 'Anotação 🎉 com "aspas", +mais+ e /barras/';
const SCHEMES: EncodingScheme[] = ['base64', 'base64url', 'url', 'hex'];

function unwrap(outcome: ReturnType<typeof encodeText>): string {
  if (!outcome.ok) throw new Error(`expected a value, got: ${outcome.message}`);
  return outcome.text;
}

describe('round trip', () => {
  it('brings accents, emoji and punctuation back in every scheme', () => {
    for (const scheme of SCHEMES) {
      const encoded = unwrap(encodeText(TRICKY, scheme));
      expect(unwrap(decodeText(encoded, scheme)), scheme).toBe(TRICKY);
    }
  });

  it('takes an empty text as empty, not as an error', () => {
    for (const scheme of SCHEMES) {
      expect(encodeText('', scheme), scheme).toEqual({ ok: true, text: '' });
      expect(decodeText('', scheme), scheme).toEqual({ ok: true, text: '' });
    }
  });
});

describe('base64', () => {
  it('encodes UTF-8 bytes, not latin-1 characters', () => {
    // `btoa('ção')` throws; going through the bytes is the whole point.
    expect(unwrap(encodeText('ção', 'base64'))).toBe('w6fDo28=');
  });

  it('keeps base64url free of +, / and =', () => {
    const encoded = unwrap(encodeText('???>>>ÿÿÿ', 'base64url'));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(unwrap(decodeText(encoded, 'base64url'))).toBe('???>>>ÿÿÿ');
  });

  it('decodes with or without padding', () => {
    expect(unwrap(decodeText('w6fDo28=', 'base64'))).toBe('ção');
    expect(unwrap(decodeText('w6fDo28', 'base64'))).toBe('ção');
  });

  it('refuses a character that is not base64', () => {
    expect(decodeText('abc$', 'base64')).toEqual({
      ok: false,
      message: 'Isto não é base64: só letras, números, +, / e = (ou -, _ em base64url).',
    });
  });

  it('says when the bytes are not UTF-8 text', () => {
    expect(decodeText('//79', 'base64')).toMatchObject({ ok: false });
  });
});

describe('hex', () => {
  it('writes lowercase and reads spaces and uppercase', () => {
    expect(unwrap(encodeText('AZ', 'hex'))).toBe('415a');
    expect(unwrap(decodeText('41 5A', 'hex'))).toBe('AZ');
    expect(unwrap(decodeText('41\n5a', 'hex'))).toBe('AZ');
  });

  it('refuses an odd number of digits and anything that is not a digit', () => {
    expect(decodeText('415', 'hex')).toEqual({
      ok: false,
      message: 'Hex precisa de um número par de dígitos.',
    });
    expect(decodeText('41zz', 'hex')).toEqual({
      ok: false,
      message: 'Isto não é hex: use apenas 0-9 e a-f.',
    });
  });
});

describe('url', () => {
  it('leaves no doubt about spaces and plus signs', () => {
    expect(unwrap(encodeText('a b+c', 'url'))).toBe('a%20b%2Bc');
    expect(unwrap(decodeText('a%20b%2Bc', 'url'))).toBe('a b+c');
  });

  it('refuses a broken escape', () => {
    expect(decodeText('%zz', 'url')).toEqual({
      ok: false,
      message: 'Isto não é URL-encode: há um % sem os dois dígitos.',
    });
  });
});

describe('encodeBytes', () => {
  it('encodes raw bytes for the schemes that can carry them', () => {
    const bytes = new Uint8Array([0, 255, 16]);
    expect(encodeBytes(bytes, 'base64')).toBe('AP8Q');
    expect(encodeBytes(bytes, 'base64url')).toBe('AP8Q');
    expect(encodeBytes(bytes, 'hex')).toBe('00ff10');
    expect(SCHEMES_FOR_BYTES).not.toContain('url');
  });

  it('handles a payload bigger than one chunk without blowing the stack', () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(encodeBytes(big, 'base64')).toHaveLength(Math.ceil(200_000 / 3) * 4);
  });
});
