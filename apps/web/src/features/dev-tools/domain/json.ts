export type JsonIndent = 2 | 4 | 'tab';

export type JsonOutcome =
  | { ok: true; text: string }
  | { ok: false; message: string; line: number | null; column: number | null };

export function formatJson(text: string, indent: JsonIndent): JsonOutcome {
  return transform(text, (value) => JSON.stringify(value, null, indent === 'tab' ? '\t' : indent));
}

export function minifyJson(text: string): JsonOutcome {
  return transform(text, (value) => JSON.stringify(value));
}

// ponytail: numbers go through JSON.parse, so integers above 2^53 come back rounded; a parser with a
// reviver (or BigInt) only if a real document needs it. The tool says so on screen.
function transform(text: string, render: (value: unknown) => string): JsonOutcome {
  if (!text.trim()) return { ok: true, text: '' };
  try {
    return { ok: true, text: render(JSON.parse(text)) };
  } catch (error) {
    return failure(error, text);
  }
}

function failure(error: unknown, text: string): JsonOutcome {
  const raw = error instanceof Error ? error.message : String(error);
  // The engine leaves the position out of its most common message ("Unexpected token 'x', ..."), so
  // the scan below is what usually answers "where?"; the message is the fallback.
  const index = findSyntaxErrorIndex(text) ?? indexFromMessage(raw);
  const place = index === null ? null : lineAndColumn(text, index);
  return {
    ok: false,
    message: cleanMessage(raw),
    line: place?.line ?? null,
    column: place?.column ?? null,
  };
}

/**
 * Strips what the engine repeats — the position we show apart, and the echo of the document — and
 * escapes control characters, so a line break inside the message reads as `\n` instead of a blank.
 */
function cleanMessage(raw: string): string {
  return raw
    .replace(/,?\s*(\.\.\.)?".*"\s+is not valid JSON$/s, '')
    .replace(/\s+in JSON at position \d+(\s*\(line \d+ column \d+\))?$/, '')
    .trim()
    .split('')
    .map((char) => (char < ' ' ? JSON.stringify(char).slice(1, -1) : char))
    .join('');
}

function indexFromMessage(raw: string): number | null {
  const match = /at position (\d+)/.exec(raw);
  return match ? Number(match[1]) : null;
}

function lineAndColumn(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const lastBreak = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: index - lastBreak };
}

class ScanError extends Error {
  constructor(readonly index: number) {
    super(`JSON cannot have the character at ${index}`);
  }
}

const WHITESPACE = new Set([' ', '\n', '\r', '\t']);
const SIMPLE_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/;

/**
 * Index of the first character a JSON document cannot have, or `null` when the scan sees nothing
 * wrong. It never decides whether the text is valid — `JSON.parse` does that — it only answers
 * *where*, so a disagreement can only cost us the position, never turn a good document into a bad
 * one.
 */
export function findSyntaxErrorIndex(text: string): number | null {
  let i = 0;

  function fail(at: number = i): never {
    throw new ScanError(at);
  }

  function whitespace(): void {
    while (i < text.length && WHITESPACE.has(text[i] as string)) i++;
  }

  function literal(word: string): void {
    if (!text.startsWith(word, i)) fail();
    i += word.length;
  }

  function number(): void {
    const match = NUMBER.exec(text.slice(i));
    if (!match?.[0]) fail();
    i += match[0].length;
  }

  function string(): void {
    i++; // opening quote
    for (;;) {
      if (i >= text.length) fail(text.length);
      const char = text[i] as string;
      if (char === '"') {
        i++;
        return;
      }
      if (char === '\\') {
        const escaped = text[i + 1];
        if (escaped === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail();
          i += 6;
          continue;
        }
        if (!escaped || !SIMPLE_ESCAPES.has(escaped)) fail();
        i += 2;
        continue;
      }
      // A raw control character — most often a line break someone left inside a string.
      if (char < ' ') fail();
      i++;
    }
  }

  function array(): void {
    i++; // [
    whitespace();
    if (text[i] === ']') {
      i++;
      return;
    }
    for (;;) {
      whitespace();
      value();
      whitespace();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ']') {
        i++;
        return;
      }
      fail();
    }
  }

  function object(): void {
    i++; // {
    whitespace();
    if (text[i] === '}') {
      i++;
      return;
    }
    for (;;) {
      whitespace();
      if (text[i] !== '"') fail();
      string();
      whitespace();
      if (text[i] !== ':') fail();
      i++;
      whitespace();
      value();
      whitespace();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return;
      }
      fail();
    }
  }

  function value(): void {
    if (i >= text.length) fail(text.length);
    const char = text[i] as string;
    if (char === '{') object();
    else if (char === '[') array();
    else if (char === '"') string();
    else if (char === 't') literal('true');
    else if (char === 'f') literal('false');
    else if (char === 'n') literal('null');
    else if (char === '-' || (char >= '0' && char <= '9')) number();
    else fail();
  }

  try {
    whitespace();
    value();
    whitespace();
    return i === text.length ? null : i;
  } catch (error) {
    if (error instanceof ScanError) return error.index;
    // Deep enough nesting overflows the stack here; the engine message is then the only answer.
    return null;
  }
}
