import { buttonVariants } from '@septo/ui/components/button';
import { Input } from '@septo/ui/components/input';
import { DownloadIcon, UploadIcon } from 'lucide-react';
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
import { Segmented } from './segmented';
import { Pane, Workspace } from './workspace';

type Source = { file: File; bitmap: ImageBitmap };
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

  // Created in the effect (not the handler) so a re-run effect never revokes a URL still on screen.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!source) return;
    const url = URL.createObjectURL(source.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

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
          name: outputFileName(source.file.name, format),
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
      setSource({ file, bitmap });
    } catch {
      setProblem('Este arquivo não parece uma imagem que o navegador saiba abrir.');
    }
  }

  const lossy = formatInfo(format).lossy;

  return (
    <Workspace
      to="/dev-tools/image"
      toolbar={
        <>
          <Segmented
            legend="Formato de saída"
            name="image-format"
            value={format}
            options={IMAGE_FORMATS.filter((option) => supported.includes(option.value))}
            onChange={setFormat}
          />
          <label htmlFor="image-max-width" className="text-xs text-muted-foreground">
            Largura máxima
          </label>
          <Input
            id="image-max-width"
            type="number"
            min={1}
            inputMode="numeric"
            value={maxWidth}
            onChange={(event) => setMaxWidth(event.target.value)}
            placeholder="original"
            className="h-7 w-24 text-xs md:text-xs"
          />
          {lossy && (
            <>
              <label htmlFor="image-quality" className="text-xs text-muted-foreground">
                Qualidade
              </label>
              <input
                id="image-quality"
                type="range"
                min={10}
                max={100}
                step={5}
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
                className="w-24 accent-(--brand-text)"
              />
              <span className="w-8 text-xs text-muted-foreground tabular-nums">{quality}%</span>
            </>
          )}
        </>
      }
      error={problem}
      info={
        source &&
        result &&
        `${source.bitmap.width}×${source.bitmap.height} · ${formatBytes(source.file.size)} → ${result.width}×${result.height} · ${formatBytes(result.bytes)} (${percentage(source.file.size, result.bytes)})`
      }
    >
      <Pane label="Original">
        <FileDrop
          accept="image/*"
          maxBytes={MAX_IMAGE_BYTES}
          tooLarge={IMAGE_TOO_LARGE}
          onFile={readFile}
          onReject={setProblem}
          title={source ? 'Trocar a imagem' : undefined}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40 has-focus-visible:ring-inset data-over:bg-brand-subtle data-over:text-brand-text"
        >
          {source && preview ? (
            <img
              src={preview}
              alt={`Original: ${source.file.name}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <>
              <UploadIcon className="size-5 text-brand-text" aria-hidden="true" />
              Solte uma imagem ou clique para escolher
            </>
          )}
        </FileDrop>
      </Pane>
      <Pane
        label="Convertida"
        actions={
          result && (
            <a
              href={result.url}
              download={result.name}
              className={buttonVariants({ variant: 'ghost', size: 'xs' })}
            >
              <DownloadIcon aria-hidden="true" />
              Baixar {result.name}
            </a>
          )
        }
      >
        {result && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <img
              src={result.url}
              alt="Prévia da imagem convertida"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
      </Pane>
    </Workspace>
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
