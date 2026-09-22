import { Button, buttonVariants } from '@septo/ui/components/button';
import { ArrowLeftRightIcon, UploadIcon } from 'lucide-react';
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
import { LazyCodeEditor } from './lazy-code-editor';
import { Segmented } from './segmented';
import { Pane, Workspace } from './workspace';

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

  const fileButton = (
    <FileDrop
      maxBytes={MAX_TEXT_CHARS}
      tooLarge={TEXT_TOO_LARGE}
      onFile={readFile}
      onReject={setRejection}
      disabled={!fileScheme}
      title={fileScheme ? 'Codificar um arquivo' : 'URL-encode é só para texto'}
      className={buttonVariants({
        variant: 'ghost',
        size: 'xs',
        className: 'data-over:bg-brand-subtle data-over:text-brand-text',
      })}
    >
      <UploadIcon aria-hidden="true" />
      Arquivo
    </FileDrop>
  );

  return (
    <Workspace
      to="/dev-tools/encode"
      toolbar={
        <>
          <Segmented
            legend="Esquema"
            name="scheme"
            value={scheme}
            options={SCHEMES}
            onChange={setScheme}
          />
          <Button variant="outline" size="sm" onClick={swap}>
            <ArrowLeftRightIcon aria-hidden="true" />
            Inverter
          </Button>
        </>
      }
      error={problem}
    >
      {source.kind === 'file' ? (
        <Pane label="Arquivo" actions={fileButton}>
          <div className="flex h-full flex-col items-start justify-center gap-2 px-4 md:px-6">
            <p className="font-mono text-sm">{source.name}</p>
            <p className="text-sm text-muted-foreground">
              {source.bytes.length.toLocaleString('pt-BR')} bytes
            </p>
            <Button variant="outline" size="sm" onClick={() => takeText('')}>
              Voltar para texto
            </Button>
          </div>
        </Pane>
      ) : (
        <Pane
          label={decoding ? 'Codificado' : 'Texto'}
          labelId="encode-input-label"
          actions={fileButton}
        >
          <LazyCodeEditor
            labelledBy="encode-input-label"
            value={source.value}
            onChange={takeText}
            wrap
          />
        </Pane>
      )}
      <Pane
        label={decoding && source.kind === 'text' ? 'Texto' : 'Codificado'}
        labelId="encode-output-label"
        actions={<CopyButton value={output} />}
      >
        <LazyCodeEditor labelledBy="encode-output-label" value={output} readOnly wrap />
      </Pane>
    </Workspace>
  );
}
