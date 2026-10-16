import {
  MAX_SEARCH_LENGTH,
  normalizeSearchText,
  searchTerms,
} from './search-text';

describe('normalizeSearchText', () => {
  it('lowercases and collapses spaces', () => {
    expect(normalizeSearchText('  Veng   SRENG\tBlvd ')).toBe(
      'veng sreng blvd',
    );
  });

  it('removes LIKE wildcards so they match literally nothing special', () => {
    expect(normalizeSearchText('%')).toBe('');
    expect(normalizeSearchText('a_b\\c%d')).toBe('a b c d');
  });

  it('keeps Khmer text', () => {
    expect(normalizeSearchText(' ផ្លូវវេងស្រេង ')).toBe('ផ្លូវវេងស្រេង');
  });

  it('cuts long texts', () => {
    expect(normalizeSearchText('a'.repeat(500))).toHaveLength(
      MAX_SEARCH_LENGTH,
    );
  });
});

describe('searchTerms', () => {
  it('splits into distinct words, at most five', () => {
    expect(searchTerms('veng sreng veng')).toEqual(['veng', 'sreng']);
    expect(searchTerms('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(searchTerms('')).toEqual([]);
  });
});
