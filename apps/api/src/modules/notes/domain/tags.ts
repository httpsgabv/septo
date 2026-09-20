import { InvalidTagError } from './errors.js';

export const MAX_TAGS = 10;
export const TAG_MAX_LENGTH = 30;

const TAG_PATTERN = /^[\p{L}\p{N}._-]+$/u;

/** A tag is a label, not free text: trimmed, lowercase, spaces become dashes. */
export function normalizeTag(raw: string): string {
  const tag = raw.trim().toLowerCase().replace(/ +/g, '-').normalize('NFC');
  if (tag.length < 1 || tag.length > TAG_MAX_LENGTH || !TAG_PATTERN.test(tag)) {
    throw new InvalidTagError();
  }
  return tag;
}

/** Normalizes every tag and drops duplicates, keeping the order of first appearance. */
export function normalizeTags(raw: readonly string[]): string[] {
  const tags = [...new Set(raw.map(normalizeTag))];
  if (tags.length > MAX_TAGS) throw new InvalidTagError();
  return tags;
}
