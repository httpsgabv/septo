/**
 * Every tool works on the main thread, so they refuse what would freeze the tab instead of trying.
 * ponytail: fixed client-side limits; a Web Worker only if a real document ever hits one.
 */
export const MAX_TEXT_CHARS = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const TEXT_TOO_LARGE = 'Texto grande demais: o limite é 2 MB.';
export const IMAGE_TOO_LARGE = 'Imagem grande demais: o limite é 25 MB.';
