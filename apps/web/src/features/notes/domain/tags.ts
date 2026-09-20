// Mirrors apps/api/src/modules/notes/domain/tags.ts: same normalization, same limits.
export const MAX_TAGS = 10;
export const TAG_MAX_LENGTH = 30;

const TAG_PATTERN = /^[\p{L}\p{N}._-]+$/u;

export const TAG_ERRORS = {
  invalid: `Tag inválida: use letras, números, ponto, hífen ou sublinhado (até ${TAG_MAX_LENGTH} caracteres).`,
  duplicate: 'Essa tag já está na nota.',
  limit: `Uma nota pode ter até ${MAX_TAGS} tags.`,
};

/** Trimmed, lowercase, spaces become dashes; `null` when the API would refuse it. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/ +/g, '-').normalize('NFC');
  return tag.length >= 1 && tag.length <= TAG_MAX_LENGTH && TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * Adds what was typed or pasted (comma separated) to the tags of a note. What cannot go in is left
 * out and the first reason comes back as `error`; what can still goes in.
 */
export function addTags(
  current: readonly string[],
  input: string,
): { tags: string[]; error?: string } {
  const tags = [...current];
  let error: string | undefined;
  for (const piece of input.split(',')) {
    if (!piece.trim()) continue;
    const tag = normalizeTag(piece);
    if (!tag) error ??= TAG_ERRORS.invalid;
    else if (tags.includes(tag)) error ??= TAG_ERRORS.duplicate;
    else if (tags.length >= MAX_TAGS) {
      error ??= TAG_ERRORS.limit;
      break;
    } else tags.push(tag);
  }
  return error ? { tags, error } : { tags };
}
