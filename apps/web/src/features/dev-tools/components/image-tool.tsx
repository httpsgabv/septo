import { buttonVariants } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { useEffect, useState } from 'react';
import {
  fitWithin,
  formatBytes,
  formatInfo,
  IMAGE_FORMATS,
  type ImageFormat,
  outputFileName,
} from '../domain/image';
import { IMAGE_TOO_LARGE, MAX_IMAGE_BYTES } from '../domain/limits';
import { FileDrop } from './file-drop';

type Source = { name: string; bytes: number; bitmap: ImageBitmap };
type Result = { url: string; bytes: number; width: number; height: number; name: string };

export function ImageTool() {
  const [supported, setSupported] = useState<ImageFormat[]>([]);
  const [format, setFormat] = useState<ImageFormat>('webp');
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // What this browser can actually encode: a format it only decodes would download a PNG in disguise.
  useEffect(() => {
    let alive = true;
    encodableFormats().then((formats) => {
      if (!alive) return;
      setSupported(formats);
      setFormat((current) => (formats.includes(current) ? current : (formats[0] ?? 'png')));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    let url: string | null = null;
    let alive = true;

    const limit = Number.parseInt(maxWidth, 10);
    const size = fitWithin(
      source.bitmap.width,
      source.bitmap.height,
      Number.isFinite(limit) && limit > 0 ? limit : null,
    );

    encode(source.bitmap, size, format, quality / 100)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setProblem(null);
        setResult({
          url,
          bytes: blob.size,
          width: size.width,
          height: size.height,
          name: outputFileName(source.name, format),
        });
      })
      .catch(() => {
        if (alive) setProblem('Não deu para converter esta imagem neste formato.');
      });

    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, format, quality, maxWidth]);

  async function readFile(file: File): Promise<void> {
    setProblem(null);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      setSource({ name: file.name, bytes: file.size, bitmap });
    } catch {
      setProblem('Este arquivo não parece uma imagem que o navegador saiba abrir.');
    }
  }

  const lossy = formatInfo(format).lossy;

  return (
    <div className="flex flex-col gap-4">
      <FileDrop
        label={
          source ? `${source.name} — escolher outra` : 'Arraste uma imagem ou clique para escolher'
        }
        accept="image/*"
        maxBytes={MAX_IMAGE_BYTES}
        tooLarge={IMAGE_TOO_LARGE}
        onFile={readFile}
        onReject={setProblem}
      />

      <div className="flex flex-wrap items-center gap-4">
        <fieldset>
          <legend className="sr-only">Formato de saída</legend>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {IMAGE_FORMATS.filter((option) => supported.includes(option.value)).map((option) => (
              <label
                key={option.value}
                className="cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="image-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          Largura máxima
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={maxWidth}
            onChange={(event) => setMaxWidth(event.target.value)}
            placeholder="original"
            className="w-28"
          />
        </label>

        {lossy && (
          <label className="flex items-center gap-2 text-sm">
            Qualidade
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
            <span className="w-10 tabular-nums text-muted-foreground">{quality}%</span>
          </label>
        )}
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {problem && <span className="text-destructive">{problem}</span>}
      </p>

      {source && result && (
        <div className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-start">
          <img
            src={result.url}
            alt="Prévia da imagem convertida"
            className="max-h-80 w-auto rounded-lg border"
          />
          <div className="flex flex-col items-start gap-2 text-sm">
            <p>
              {source.bitmap.width}×{source.bitmap.height} · {formatBytes(source.bytes)}
            </p>
            <p className="font-medium">
              → {result.width}×{result.height} · {formatBytes(result.bytes)}{' '}
              <span className="text-muted-foreground">
                ({percentage(source.bytes, result.bytes)})
              </span>
            </p>
            <a
              href={result.url}
              download={result.name}
              className={buttonVariants({ variant: 'default' })}
            >
              Baixar {result.name}
            </a>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A imagem é reescrita pelo navegador, o que descarta os metadados EXIF — inclusive a
        localização de onde a foto foi tirada.
      </p>
    </div>
  );
}

function percentage(before: number, after: number): string {
  const change = Math.round((after / before) * 100 - 100);
  return change <= 0 ? `${change}%` : `+${change}%`;
}

async function encode(
  bitmap: ImageBitmap,
  size: { width: number; height: number },
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  if (format === 'jpeg') {
    // JPEG has no transparency: without this, transparent pixels come out black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);

  const { mimeType } = formatInfo(format);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
  if (!blob || blob.type !== mimeType) throw new Error(`cannot encode ${mimeType}`);
  return blob;
}

async function encodableFormats(): Promise<ImageFormat[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const checked = await Promise.all(
    IMAGE_FORMATS.map(async (option) => {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, option.mimeType, 0.5);
      });
      return blob?.type === option.mimeType ? option.value : null;
    }),
  );
  return checked.filter((value): value is ImageFormat => value !== null);
}
