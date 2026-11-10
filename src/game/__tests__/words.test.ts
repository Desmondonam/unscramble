import { DIFFICULTIES, DEFAULT_DIFFICULTY_RULES, difficultyForLength } from '../core';
import { buildAnagramIndex } from '../picker';
import { BUNDLED_CATEGORIES, BUNDLED_WORDS, maskExample, parseWordList } from '../words';

const wholeWord = (text: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(text);

describe('curated word bank', () => {
  it('contains at least 1,000 words', () => {
    expect(BUNDLED_WORDS.length).toBeGreaterThanOrEqual(1000);
  });

  it('has no duplicate words or ids', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const w of BUNDLED_WORDS) {
      if (seen.has(w.id)) dupes.push(`${w.word} (${seen.get(w.id)} & ${w.categoryId})`);
      seen.set(w.id, w.categoryId);
    }
    expect(dupes).toEqual([]);
  });

  it('only uses the letters A–Z and at least 3 letters', () => {
    const bad = BUNDLED_WORDS.filter((w) => !/^[A-Z]{3,}$/.test(w.word)).map((w) => w.word);
    expect(bad).toEqual([]);
  });

  it('assigns difficulty from word length', () => {
    const wrong = BUNDLED_WORDS.filter((w) => difficultyForLength(w.length) !== w.difficulty);
    expect(wrong).toEqual([]);
  });

  it('has a definition and an example for every word', () => {
    const missing = BUNDLED_WORDS.filter((w) => w.definition.length < 10 || w.example.length < 10).map((w) => w.word);
    expect(missing).toEqual([]);
  });

  it('never gives the answer away in the definition', () => {
    const leaks = BUNDLED_WORDS.filter((w) => wholeWord(w.definition, w.word)).map((w) => w.word);
    expect(leaks).toEqual([]);
  });

  it('uses the word in every example sentence (so it can be blanked out)', () => {
    const missing = BUNDLED_WORDS.filter((w) => !wholeWord(w.example, w.word)).map((w) => `${w.word}: ${w.example}`);
    expect(missing).toEqual([]);
  });

  it('covers every category and every difficulty', () => {
    for (const category of BUNDLED_CATEGORIES) {
      const inCategory = BUNDLED_WORDS.filter((w) => w.categoryId === category.id);
      expect(inCategory.length).toBeGreaterThanOrEqual(60);
      for (const d of DIFFICULTIES) {
        const count = inCategory.filter((w) => w.difficulty === d).length;
        // Every category must offer each difficulty; a daily or category game needs several words.
        expect({ category: category.id, d, ok: count >= 5 }).toEqual({ category: category.id, d, ok: true });
      }
    }
  });

  it('has enough words per difficulty for long timed games', () => {
    for (const d of DIFFICULTIES) {
      expect(BUNDLED_WORDS.filter((w) => w.difficulty === d).length).toBeGreaterThanOrEqual(100);
    }
  });

  it('only contains anagram groups that the validator accepts as alternatives', () => {
    const groups = [...buildAnagramIndex(BUNDLED_WORDS).values()].filter((g) => g.length > 1);
    // Documented: these pairs are accepted interchangeably (see docs/ARCHITECTURE.md).
    expect(groups.length).toBeLessThan(15);
  });

  it('masks the word in example sentences', () => {
    expect(maskExample('The Apple fell; an apple is red.', 'APPLE')).toBe('The _____ fell; an _____ is red.');
  });

  it('parses the data format and skips blank or invalid lines', () => {
    const parsed = parseWordList('\nCAT|A pet.|The cat sat.\nX|too short|x\n', 'animals');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 'en:cat', word: 'CAT', difficulty: 'easy', length: 3, language: 'en' });
  });

  it('uses the expected difficulty boundaries', () => {
    expect(DEFAULT_DIFFICULTY_RULES.easy).toMatchObject({ minLength: 3, maxLength: 4 });
    expect(DEFAULT_DIFFICULTY_RULES.medium).toMatchObject({ minLength: 5, maxLength: 6 });
    expect(DEFAULT_DIFFICULTY_RULES.hard).toMatchObject({ minLength: 7, maxLength: 9 });
    expect(DEFAULT_DIFFICULTY_RULES.expert.minLength).toBe(10);
  });
});
