export type EncodingScheme = 'base64' | 'base64url' | 'url' | 'hex';

export type EncodingOutcome = { ok: true; text: string } | { ok: false; message: string };

/** URL-encode describes text, not bytes, so a dropped file can only go through the other three. */
export const SCHEMES_FOR_BYTES: EncodingScheme[] = ['base64', 'base64url', 'hex'];

const NOT_BASE64 = 'Isto não é base64: só letras, números, +, / e = (ou -, _ em base64url).';
const NOT_HEX = 'Isto não é hex: use apenas 0-9 e a-f.';
const ODD_HEX = 'Hex precisa de um número par de dígitos.';
const NOT_URL = 'Isto não é URL-encode: há um % sem os dois dígitos.';
const NOT_TEXT = 'Esses bytes não formam texto UTF-8.';
const NOT_ENCODABLE = 'O texto tem um caractere que não dá para codificar.';

export function encodeText(text: string, scheme: EncodingScheme): EncodingOutcome {
  if (text === '') return { ok: true, text: '' };
  if (scheme === 'url') {
    try {
      return { ok: true, text: encodeURIComponent(text) };
    } catch {
      return { ok: false, message: NOT_ENCODABLE };
    }
  }
  return { ok: true, text: encodeBytes(new TextEncoder().encode(text), scheme) };
}

export function decodeText(encoded: string, scheme: EncodingScheme): EncodingOutcome {
  if (encoded === '') return { ok: true, text: '' };
  if (scheme === 'url') {
    try {
      return { ok: true, text: decodeURIComponent(encoded) };
    } catch {
      return { ok: false, message: NOT_URL };
    }
  }

  const bytes = scheme === 'hex' ? hexToBytes(encoded) : base64ToBytes(encoded);
  if (typeof bytes === 'string') return { ok: false, message: bytes };

  try {
    // `fatal` so half a character or a truncated payload says so instead of showing U+FFFD.
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, message: NOT_TEXT };
  }
}

export function encodeBytes(bytes: Uint8Array, scheme: EncodingScheme): string {
  if (scheme === 'hex') return bytesToHex(bytes);
  const base64 = bytesToBase64(bytes);
  return scheme === 'base64url'
    ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : base64;
}

// `String.fromCharCode(...bytes)` on a whole file blows the argument limit, so it goes in chunks.
const CHUNK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** The bytes, or the message saying why the text is not base64. */
function base64ToBytes(text: string): Uint8Array | string {
  const compact = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return NOT_BASE64;

  const padded = compact.padEnd(Math.ceil(compact.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return NOT_BASE64;
  }
}

/** The bytes, or the message saying why the text is not hex. */
function hexToBytes(text: string): Uint8Array | string {
  const compact = text.replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]*$/.test(compact)) return NOT_HEX;
  if (compact.length % 2 !== 0) return ODD_HEX;

  const bytes = new Uint8Array(compact.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
