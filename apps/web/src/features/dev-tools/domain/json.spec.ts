import { describe, expect, it } from 'vitest';
import { findSyntaxErrorIndex, formatJson, minifyJson } from './json';

const MESSY = '{"a":1,"b":[1,2],"c":{"d":null}}';

describe('formatJson', () => {
  it('formats with two spaces, four spaces or a tab', () => {
    expect(formatJson('{"a":1}', 2)).toEqual({ ok: true, text: '{\n  "a": 1\n}' });
    expect(formatJson('{"a":1}', 4)).toEqual({ ok: true, text: '{\n    "a": 1\n}' });
    expect(formatJson('{"a":1}', 'tab')).toEqual({ ok: true, text: '{\n\t"a": 1\n}' });
  });

  it('keeps nested values, arrays and null', () => {
    const formatted = formatJson(MESSY, 2);
    expect(formatted.ok).toBe(true);
    if (formatted.ok) expect(JSON.parse(formatted.text)).toEqual(JSON.parse(MESSY));
  });

  it('takes an empty document as empty, not as an error', () => {
    expect(formatJson('', 2)).toEqual({ ok: true, text: '' });
    expect(formatJson('   \n  ', 2)).toEqual({ ok: true, text: '' });
  });
});

describe('minifyJson', () => {
  it('strips every space it can', () => {
    expect(minifyJson('{\n  "a": 1\n}')).toEqual({ ok: true, text: '{"a":1}' });
  });

  it('takes an empty document as empty', () => {
    expect(minifyJson('  ')).toEqual({ ok: true, text: '' });
  });
});

describe('a broken document says where it broke', () => {
  it('points at a trailing comma (the engine gives the position here)', () => {
    const outcome = formatJson('{\n  "a": 1,\n}', 2);
    expect(outcome).toMatchObject({ ok: false, line: 3, column: 1 });
  });

  it('points at a bad literal (the engine gives no position for this one)', () => {
    const outcome = formatJson('{\n  "a": 1,\n  "b": tru\n}', 2);
    expect(outcome).toMatchObject({ ok: false, line: 3, column: 8 });
    // The engine blames the line break after `tru`; escaped, so the message never shows a blank.
    if (!outcome.ok) expect(outcome.message).toBe("Unexpected token '\\n'");
  });

  it('points at the very first character', () => {
    expect(formatJson('x{}', 2)).toMatchObject({ ok: false, line: 1, column: 1 });
  });

  it('points at the end when the document stops halfway', () => {
    expect(formatJson('{"a": 1', 2)).toMatchObject({ ok: false, line: 1, column: 8 });
  });

  it('points at a line break inside a string', () => {
    // The string opens at column 8 of line 2; the break at column 10 is what cannot be there.
    expect(formatJson('{\n  "a": "b\nc"\n}', 2)).toMatchObject({ ok: false, line: 2, column: 10 });
  });

  it('drops the position and the snippet the engine repeats in its message', () => {
    const outcome = formatJson('{\n  "a": 1,\n}', 2);
    if (outcome.ok) throw new Error('expected a failure');
    expect(outcome.message).toBe('Expected double-quoted property name');
    expect(outcome.message).not.toMatch(/position|line \d/);
  });

  it('keeps what the engine message says, minus the position', () => {
    const outcome = formatJson('{"a": 1', 2);
    if (outcome.ok) throw new Error('expected a failure');
    expect(outcome.message).toBe("Expected ',' or '}' after property value");
  });
});

describe('findSyntaxErrorIndex', () => {
  it('finds nothing wrong in valid documents', () => {
    const valid = [
      '{}',
      '[]',
      'null',
      'true',
      '-0.5e+10',
      '"com acento e \\u00e7"',
      '{"a":[1,{"b":"c"},[]],"d":false}',
      ' \n {"a" : 1} \n ',
      '"barra \\\\ e aspas \\" dentro"',
    ];
    for (const text of valid) expect(findSyntaxErrorIndex(text), text).toBeNull();
  });

  it('finds the first character that cannot be there', () => {
    expect(findSyntaxErrorIndex('{"a": 01}')).toBe(7);
    expect(findSyntaxErrorIndex('{"a": 1}}')).toBe(8);
    expect(findSyntaxErrorIndex('[1, 2,]')).toBe(6);
    expect(findSyntaxErrorIndex('{"a" 1}')).toBe(5);
    expect(findSyntaxErrorIndex('{"a": "b\\qc"}')).toBe(8);
    expect(findSyntaxErrorIndex('{"a": "b\\u12zz"}')).toBe(8);
  });

  it('reports the end of the text when the document is cut short', () => {
    expect(findSyntaxErrorIndex('{"a": ')).toBe(6);
    expect(findSyntaxErrorIndex('"aberta')).toBe(7);
  });
});

describe('known limits', () => {
  it('loses precision above 2^53, like JSON.parse itself (the tool says so on screen)', () => {
    const outcome = minifyJson('{"n":12345678901234567890}');
    expect(outcome).toEqual({ ok: true, text: '{"n":12345678901234567000}' });
  });
});
