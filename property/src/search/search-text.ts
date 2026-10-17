/** Shorter texts match too much to be useful, and cost a database query each. */
export const MIN_SEARCH_LENGTH = 2;

/** Longer texts are cut: nobody types a whole paragraph into a search bar. */
export const MAX_SEARCH_LENGTH = 80;

/** Words beyond this many add nothing but cost to the query. */
const MAX_TERMS = 5;

/**
 * The text as it is matched and cached: lowercase, single spaces, and none of
 * the characters LIKE treats as wildcards (`%`, `_`, `\`), so a search for
 * "%" cannot turn into "everything".
 */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFC')
    .toLowerCase()
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .trim();
}

/**
 * The distinct words of a normalized text. A match must contain every one of
 * them, in any order: "sreng veng" finds "Veng Sreng".
 */
export function searchTerms(normalized: string): string[] {
  return [...new Set(normalized.split(' ').filter(Boolean))].slice(
    0,
    MAX_TERMS,
  );
}
