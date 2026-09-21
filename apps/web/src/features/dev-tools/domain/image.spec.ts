import { describe, expect, it } from 'vitest';
import { fitWithin, formatBytes, IMAGE_FORMATS, outputFileName } from './image';

describe('fitWithin', () => {
  it('keeps the proportion and rounds to whole pixels', () => {
    expect(fitWithin(4000, 3000, 800)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 333, 300)).toEqual({ width: 300, height: 100 });
  });

  it('never enlarges an image that is already smaller', () => {
    expect(fitWithin(400, 300, 800)).toEqual({ width: 400, height: 300 });
  });

  it('leaves the size alone when there is no limit', () => {
    expect(fitWithin(4000, 3000, null)).toEqual({ width: 4000, height: 3000 });
  });

  it('never goes below one pixel', () => {
    expect(fitWithin(4000, 3, 10)).toEqual({ width: 10, height: 1 });
  });
});

describe('outputFileName', () => {
  it('keeps the name and swaps the extension', () => {
    expect(outputFileName('foto.PNG', 'webp')).toBe('foto.webp');
    expect(outputFileName('foto de férias.jpeg', 'png')).toBe('foto de férias.png');
    expect(outputFileName('um.arquivo.com.pontos.png', 'jpeg')).toBe('um.arquivo.com.pontos.jpg');
  });

  it('adds an extension to a name that has none', () => {
    expect(outputFileName('captura', 'png')).toBe('captura.png');
  });
});

describe('formats', () => {
  it('pairs each format with its media type and extension', () => {
    for (const format of IMAGE_FORMATS) {
      expect(format.mimeType).toBe(`image/${format.value}`);
      expect(outputFileName('x', format.value)).toBe(`x.${format.extension}`);
    }
  });
});

describe('formatBytes', () => {
  it('reads like a file manager, in pt-BR', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(1_258_291)).toBe('1,2 MB');
  });
});
