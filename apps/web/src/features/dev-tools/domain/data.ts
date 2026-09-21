import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { dump, load } from 'js-yaml';
import Papa from 'papaparse';
import { describeJsonProblem } from './json';

export type DataFormat = 'json' | 'yaml' | 'csv' | 'xml';

export type DataOutcome = { ok: true; text: string } | { ok: false; message: string };
export type ParseOutcome = { ok: true; value: unknown } | { ok: false; message: string };

export const FORMAT_LABELS: Record<DataFormat, string> = {
  json: 'JSON',
  yaml: 'YAML',
  csv: 'CSV',
  xml: 'XML',
};

const CSV_NEEDS_TABLE = 'O CSV precisa de uma lista de objetos simples (sem aninhamento).';

// Attributes come back as `@_nome`; it is lossy on purpose and the tool says so on screen.
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
});

/** Everything goes through a plain JS value: four formats, one pair of functions each. */
export function convertData(text: string, from: DataFormat, to: DataFormat): DataOutcome {
  const parsed = parseData(text, from);
  return parsed.ok ? serializeData(parsed.value, to) : parsed;
}

export function parseData(text: string, format: DataFormat): ParseOutcome {
  if (!text.trim()) return { ok: true, value: null };

  try {
    switch (format) {
      case 'json':
        return { ok: true, value: JSON.parse(text) };
      case 'yaml':
        // Default schema only: it builds plain values, never instantiates types from `!!js/*` tags.
        return { ok: true, value: load(text) ?? null };
      case 'csv': {
        const result = Papa.parse(text.trim(), {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });
        const problem = result.errors[0];
        return problem
          ? { ok: false, message: `CSV inválido: ${problem.message}` }
          : { ok: true, value: result.data };
      }
      case 'xml': {
        const validation = XMLValidator.validate(text);
        return validation === true
          ? { ok: true, value: xmlParser.parse(text) }
          : { ok: false, message: `XML inválido: ${validation.err.msg}` };
      }
    }
  } catch (error) {
    return { ok: false, message: parseMessage(format, text, error) };
  }
}

export function serializeData(value: unknown, format: DataFormat): DataOutcome {
  try {
    switch (format) {
      case 'json':
        return { ok: true, text: JSON.stringify(value, null, 2) ?? '' };
      case 'yaml':
        return { ok: true, text: dump(value, { noRefs: true }) };
      case 'csv':
        return isFlatTable(value)
          ? { ok: true, text: Papa.unparse(value, { newline: '\n' }) }
          : { ok: false, message: CSV_NEEDS_TABLE };
      case 'xml': {
        // XML needs exactly one root element; anything else gets wrapped in <root>.
        const rooted =
          isPlainObject(value) && Object.keys(value).length === 1 ? value : { root: value };
        return { ok: true, text: xmlBuilder.build(rooted) };
      }
    }
  } catch (error) {
    return {
      ok: false,
      message: `Não deu para escrever em ${FORMAT_LABELS[format]}: ${reason(error)}`,
    };
  }
}

/**
 * The format a document looks like, or `null` when it is anyone's guess — the picker always wins
 * over this, so guessing wrong costs a click, never the data.
 */
export function detectFormat(text: string): DataFormat | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('<')) return 'xml';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('---')) return 'yaml';

  const lines = trimmed.split('\n');
  const commas = lines[0]?.split(',').length ?? 0;
  if (commas > 1 && lines.length > 1 && lines.every((line) => line.split(',').length === commas)) {
    return 'csv';
  }
  return /^[^\s:][^:\n]*:(\s|$)/m.test(trimmed) ? 'yaml' : null;
}

function parseMessage(format: DataFormat, text: string, error: unknown): string {
  if (format === 'json') {
    const problem = describeJsonProblem(text, error);
    const where =
      problem.line === null ? '' : ` na linha ${problem.line}, coluna ${problem.column}`;
    return `JSON inválido${where}: ${problem.message}`;
  }
  return `${FORMAT_LABELS[format]} inválido: ${reason(error)}`;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] || error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A list of records: what a CSV can actually describe. */
function isFlatTable(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row) =>
        isPlainObject(row) &&
        Object.values(row).every((field) => field === null || typeof field !== 'object'),
    )
  );
}
