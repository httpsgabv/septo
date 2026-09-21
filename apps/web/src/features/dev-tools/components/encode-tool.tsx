import { Button } from '@septo/ui/components/button';
import { Textarea } from '@septo/ui/components/textarea';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  decodeText,
  type EncodingOutcome,
  type EncodingScheme,
  encodeBytes,
  encodeText,
  SCHEMES_FOR_BYTES,
} from '../domain/encoding';
import { MAX_TEXT_CHARS, TEXT_TOO_LARGE } from '../domain/limits';
import { CopyButton } from './copy-button';
import { FileDrop } from './file-drop';

const SCHEMES: { value: EncodingScheme; label: string }[] = [
  { value: 'base64', label: 'base64' },
  { value: 'base64url', label: 'base64url' },
  { value: 'url', label: 'URL' },
  { value: 'hex', label: 'hex' },
];

type Source = { kind: 'text'; value: string } | { kind: 'file'; name: string; bytes: Uint8Array };

export function EncodeTool() {
  const [scheme, setScheme] = useState<EncodingScheme>('base64');
  const [decoding, setDecoding] = useState(false);
  const [source, setSource] = useState<Source>({ kind: 'text', value: '' });
  const [rejection, setRejection] = useState<string | null>(null);

  const fileScheme = SCHEMES_FOR_BYTES.includes(scheme);

  const outcome: EncodingOutcome = useMemo(() => {
    if (source.kind === 'file') {
      return fileScheme
        ? { ok: true, text: encodeBytes(source.bytes, scheme) }
        : {
            ok: false,
            message: 'URL-encode descreve texto, não bytes: escolha base64, base64url ou hex.',
          };
    }
    if (source.value.length > MAX_TEXT_CHARS) return { ok: false, message: TEXT_TOO_LARGE };
    return decoding ? decodeText(source.value, scheme) : encodeText(source.value, scheme);
  }, [source, scheme, decoding, fileScheme]);

  const output = outcome.ok ? outcome.text : '';
  const problem = rejection ?? (outcome.ok ? null : outcome.message);

  function takeText(value: string): void {
    setRejection(null);
    setSource({ kind: 'text', value });
  }

  function swap(): void {
    setDecoding(!decoding);
    takeText(output || (source.kind === 'text' ? source.value : ''));
  }

  async function readFile(file: File): Promise<void> {
    setRejection(null);
    setSource({ kind: 'file', name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    setDecoding(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset>
          <legend className="sr-only">Esquema</legend>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {SCHEMES.map((option) => (
              <label
                key={option.value}
                className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="scheme"
                  value={option.value}
                  checked={scheme === option.value}
                  onChange={() => setScheme(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button variant="outline" onClick={swap}>
          <ArrowLeftRightIcon aria-hidden="true" />
          Inverter
        </Button>
        <span className="text-sm text-muted-foreground">
          {decoding ? 'Decodificando para texto' : 'Codificando o texto'}
        </span>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {problem && <span className="text-destructive">{problem}</span>}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="encode-input" className="text-sm font-medium">
            {source.kind === 'file' ? 'Arquivo' : decoding ? 'Codificado' : 'Texto'}
          </label>
          {source.kind === 'file' ? (
            <div className="flex h-72 flex-col items-start justify-center gap-3 rounded-lg border px-4">
              <p className="font-mono text-sm">{source.name}</p>
              <p className="text-sm text-muted-foreground">
                {source.bytes.length.toLocaleString('pt-BR')} bytes
              </p>
              <Button variant="outline" size="sm" onClick={() => takeText('')}>
                Voltar para texto
              </Button>
            </div>
          ) : (
            <Textarea
              id="encode-input"
              value={source.value}
              onChange={(event) => takeText(event.target.value)}
              spellCheck={false}
              aria-invalid={problem !== null}
              className="h-72 field-sizing-fixed font-mono text-xs"
            />
          )}
          <FileDrop
            label={
              fileScheme
                ? 'Arraste um arquivo ou clique para escolher'
                : 'URL-encode é só para texto'
            }
            maxBytes={MAX_TEXT_CHARS}
            tooLarge={TEXT_TOO_LARGE}
            onFile={readFile}
            onReject={setRejection}
            disabled={!fileScheme}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="encode-output" className="text-sm font-medium">
              {decoding && source.kind === 'text' ? 'Texto' : 'Codificado'}
            </label>
            <CopyButton value={output} />
          </div>
          <Textarea
            id="encode-output"
            value={output}
            readOnly
            spellCheck={false}
            className="h-72 field-sizing-fixed font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
}
