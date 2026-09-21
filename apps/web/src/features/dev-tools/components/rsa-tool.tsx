import { Button, buttonVariants } from '@septo/ui/components/button';
import { Textarea } from '@septo/ui/components/textarea';
import { KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { generateRsaKeyPair, RSA_SIZES, type RsaKeyPair, type RsaSize } from '../domain/rsa';
import { CopyButton } from './copy-button';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset>
          <legend className="sr-only">Tamanho da chave</legend>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {RSA_SIZES.map((size) => (
              <label
                key={size}
                className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="bits"
                  value={size}
                  checked={bits === size}
                  onChange={() => setBits(size)}
                  className="sr-only"
                />
                {size} bits
              </label>
            ))}
          </div>
        </fieldset>

        <Button onClick={generate} disabled={generating}>
          <KeyRoundIcon aria-hidden="true" />
          {generating ? 'Gerando…' : 'Gerar par de chaves'}
        </Button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {problem && <span className="text-destructive">{problem}</span>}
      </p>

      {pair && (
        <div className="grid gap-4 md:grid-cols-2">
          <KeyPanel
            id="rsa-public"
            label="Chave pública (SPKI)"
            file="chave.pub.pem"
            value={pair.publicKey}
          />
          <KeyPanel
            id="rsa-private"
            label="Chave privada (PKCS#8)"
            file="chave.pem"
            value={pair.privateKey}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        O par é gerado aqui pelo WebCrypto e vive só nesta aba: recarregar a página o descarta, e
        nada disso chega ao servidor. Guarde a chave privada antes de sair.
      </p>
    </div>
  );
}

function KeyPanel({
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <CopyButton value={value} />
          <a
            href={`data:application/x-pem-file;base64,${btoa(value)}`}
            download={file}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Baixar
          </a>
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        readOnly
        spellCheck={false}
        className="h-64 field-sizing-fixed font-mono text-[0.7rem]"
      />
    </div>
  );
}
