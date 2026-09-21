import { describe, expect, it } from 'vitest';
import { convertData, type DataFormat, detectFormat, parseData, serializeData } from './data';

const SAMPLES: Record<DataFormat, string> = {
  json: '{"nome":"Gabriel","tags":["a","b"],"ativo":true}',
  yaml: 'nome: Gabriel\ntags:\n  - a\n  - b\nativo: true\n',
  csv: 'nome,idade\nGabriel,33\nMaria,41\n',
  xml: '<pessoa><nome>Gabriel</nome><ativo>true</ativo></pessoa>',
};

function unwrap(outcome: ReturnType<typeof convertData>): string {
  if (!outcome.ok) throw new Error(`expected a value, got: ${outcome.message}`);
  return outcome.text;
}

function value(text: string, format: DataFormat): unknown {
  const parsed = parseData(text, format);
  if (!parsed.ok) throw new Error(`expected a value, got: ${parsed.message}`);
  return parsed.value;
}

describe('round trip', () => {
  it('keeps the data through JSON → YAML → JSON', () => {
    const yaml = unwrap(convertData(SAMPLES.json, 'json', 'yaml'));
    expect(unwrap(convertData(yaml, 'yaml', 'json'))).toBe(
      JSON.stringify(JSON.parse(SAMPLES.json), null, 2),
    );
  });

  it('keeps the data through JSON → XML → JSON', () => {
    const xml = unwrap(convertData('{"pessoa":{"nome":"Gabriel","ativo":true}}', 'json', 'xml'));
    expect(value(xml, 'xml')).toEqual({ pessoa: { nome: 'Gabriel', ativo: true } });
  });

  it('keeps a table through CSV → JSON → CSV', () => {
    const json = unwrap(convertData(SAMPLES.csv, 'csv', 'json'));
    expect(JSON.parse(json)).toEqual([
      { nome: 'Gabriel', idade: 33 },
      { nome: 'Maria', idade: 41 },
    ]);
    expect(unwrap(convertData(json, 'json', 'csv'))).toBe('nome,idade\nGabriel,33\nMaria,41');
  });

  it('survives a comma, a quote and a line break inside a CSV field', () => {
    const csv = 'nome,nota\n"Silva, Maria","ela disse ""oi""\nna segunda"\n';
    const parsed = value(csv, 'csv') as { nome: string; nota: string }[];
    expect(parsed[0]).toEqual({ nome: 'Silva, Maria', nota: 'ela disse "oi"\nna segunda' });
    expect(value(unwrap(serializeData(parsed, 'csv')), 'csv')).toEqual(parsed);
  });
});

describe('what each format cannot carry', () => {
  it('refuses to write CSV from anything that is not a list of flat objects', () => {
    expect(serializeData({ a: 1 }, 'csv')).toEqual({
      ok: false,
      message: 'O CSV precisa de uma lista de objetos simples (sem aninhamento).',
    });
    expect(serializeData([{ a: { b: 1 } }], 'csv')).toEqual({
      ok: false,
      message: 'O CSV precisa de uma lista de objetos simples (sem aninhamento).',
    });
  });

  it('wraps a value with no single root in <root> so the XML has one', () => {
    expect(unwrap(serializeData([1, 2], 'xml'))).toContain('<root>');
    expect(unwrap(serializeData({ a: 1, b: 2 }, 'xml'))).toContain('<root>');
  });
});

describe('a broken document says why', () => {
  it('points at the line and column of a broken JSON', () => {
    expect(convertData('{\n  "a": 1,\n}', 'json', 'yaml')).toEqual({
      ok: false,
      message: 'JSON inválido na linha 3, coluna 1: Expected double-quoted property name',
    });
  });

  it('explains a broken YAML and a broken XML', () => {
    expect(convertData('a: [1, 2\nb: 3\n', 'yaml', 'json')).toMatchObject({ ok: false });
    expect(convertData('<a><b></a>', 'xml', 'json')).toMatchObject({ ok: false });
  });

  it('never throws, whatever comes in', () => {
    const formats: DataFormat[] = ['json', 'yaml', 'csv', 'xml'];
    for (const from of formats) {
      for (const to of formats) {
        expect(() => convertData('<<<>>> não é nada disso', from, to)).not.toThrow();
      }
    }
  });
});

describe('detectFormat', () => {
  it('recognises each of the four samples', () => {
    for (const [format, text] of Object.entries(SAMPLES)) {
      expect(detectFormat(text), format).toBe(format);
    }
  });

  it('reads a JSON document as JSON, even though YAML would also accept it', () => {
    expect(detectFormat('[1, 2, 3]')).toBe('json');
  });

  it('gives up instead of guessing', () => {
    expect(detectFormat('')).toBeNull();
    expect(detectFormat('só uma frase solta')).toBeNull();
  });
});
