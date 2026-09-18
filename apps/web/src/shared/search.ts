const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * cmdk filter: plain substring match on the label and keywords, accent- and case-insensitive.
 * cmdk's default fuzzy score matches scattered letters, which is noise for short lists.
 */
export function matchesSearch(value: string, search: string, keywords: string[] = []): number {
  const query = normalize(search.trim());
  return [value, ...keywords].some((text) => normalize(text).includes(query)) ? 1 : 0;
}
