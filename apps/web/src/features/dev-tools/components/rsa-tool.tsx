import { Button, buttonVariants } from '@septo/ui/components/button';
import { DownloadIcon, KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { generateRsaKeyPair, RSA_SIZES, type RsaKeyPair, type RsaSize } from '../domain/rsa';
import { CopyButton } from './copy-button';
import { LazyCodeEditor } from './lazy-code-editor';
import { Segmented } from './segmented';
import { Pane, Workspace } from './workspace';

export function RsaTool() {
  const [bits, setBits] = useState<RsaSize>(2048);
  const [pair, setPair] = useState<RsaKeyPair | null>(null);
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setGenerating(true);
    setProblem(null);
    try {
      setPair(await generateRsaKeyPair(bits));
    } catch {
      setProblem('Não deu para gerar a chave neste navegador.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Workspace
      to="/dev-tools/rsa"
      toolbar={
        <>
          <Segmented
            legend="Tamanho da chave (bits)"
            name="bits"
            value={bits}
            options={RSA_SIZES.map((size) => ({ value: size, label: `${size} bits` }))}
            onChange={setBits}
          />
          <Button size="sm" onClick={generate} disabled={generating}>
            <KeyRoundIcon aria-hidden="true" />
            {generating ? 'Gerando…' : 'Gerar par de chaves'}
          </Button>
        </>
      }
      error={problem}
    >
      <KeyPane
        id="rsa-public"
        label="Chave pública (SPKI)"
        file="chave.pub.pem"
        value={pair?.publicKey ?? ''}
      />
      <KeyPane
        id="rsa-private"
        label="Chave privada (PKCS#8)"
        file="chave.pem"
        value={pair?.privateKey ?? ''}
      />
    </Workspace>
  );
}

function KeyPane({
  id,
  label,
  file,
  value,
}: {
  id: string;
  label: string;
  file: string;
  value: string;
}) {
  return (
    <Pane
      label={label}
      labelId={`${id}-label`}
      actions={
        value && (
          <>
            <CopyButton value={value} />
            <a
              href={`data:application/x-pem-file;base64,${btoa(value)}`}
              download={file}
              className={buttonVariants({ variant: 'ghost', size: 'xs' })}
            >
              <DownloadIcon aria-hidden="true" />
              Baixar
            </a>
          </>
        )
      }
    >
      <LazyCodeEditor labelledBy={`${id}-label`} value={value} readOnly />
    </Pane>
  );
}
