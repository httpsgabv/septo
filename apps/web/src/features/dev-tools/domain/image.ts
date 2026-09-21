export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export type ImageFormatInfo = {
  value: ImageFormat;
  label: string;
  extension: string;
  mimeType: string;
  /** PNG is lossless: the quality slider would do nothing. */
  lossy: boolean;
};

export const IMAGE_FORMATS: ImageFormatInfo[] = [
  { value: 'png', label: 'PNG', extension: 'png', mimeType: 'image/png', lossy: false },
  { value: 'jpeg', label: 'JPEG', extension: 'jpg', mimeType: 'image/jpeg', lossy: true },
  { value: 'webp', label: 'WebP', extension: 'webp', mimeType: 'image/webp', lossy: true },
  { value: 'avif', label: 'AVIF', extension: 'avif', mimeType: 'image/avif', lossy: true },
];

export function formatInfo(format: ImageFormat): ImageFormatInfo {
  const info = IMAGE_FORMATS.find((candidate) => candidate.value === format);
  if (!info) throw new Error(`Unknown image format: ${format}`);
  return info;
}

/** The size the image should be drawn at: proportional, whole pixels, and never bigger. */
export function fitWithin(
  width: number,
  height: number,
  maxWidth: number | null,
): { width: number; height: number } {
  if (maxWidth === null || width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

export function outputFileName(name: string, format: ImageFormat): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  return `${withoutExtension}.${formatInfo(format).extension}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${round(kilobytes)} kB`;
  return `${round(kilobytes / 1024)} MB`;
}

function round(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
