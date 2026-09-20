/** Accent- and case-insensitive form of a text; the web does the same in `shared/search.ts`. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** The line break keeps the end of the title from gluing to the start of the body. */
export function buildSearchText(title: string, body: string): string {
  return normalizeSearchText(`${title}\n${body}`);
}
