import { DIFFICULTIES, Difficulty, Rng, scrambleWord, sortedLetters } from './core';
import type { WordEntry } from './words';

export interface PickerOptions {
  categoryId?: string | null;
  /** Categories the player may not use (e.g. premium-only for free players). */
  excludedCategoryIds?: readonly string[];
  rng?: Rng;
}

/** Order in which to fall back to other difficulties when a pool runs dry. */
function fallbackOrder(d: Difficulty): Difficulty[] {
  const i = DIFFICULTIES.indexOf(d);
  return [...DIFFICULTIES].sort((a, b) => {
    const da = Math.abs(DIFFICULTIES.indexOf(a) - i);
    const db = Math.abs(DIFFICULTIES.indexOf(b) - i);
    return da - db || DIFFICULTIES.indexOf(a) - DIFFICULTIES.indexOf(b);
  });
}

/**
 * Picks words for a single game session without repeating any word.
 * When the requested difficulty/category pool is exhausted it falls back to
 * the nearest difficulty in the same category, and only then repeats words.
 */
export class WordPicker {
  private readonly used = new Set<string>();
  private readonly words: readonly WordEntry[];
  private readonly rng: Rng;

  constructor(words: readonly WordEntry[], private readonly options: PickerOptions = {}) {
    const excluded = new Set(options.excludedCategoryIds ?? []);
    this.words = words.filter(
      (w) => w.isActive && !excluded.has(w.categoryId) && (!options.categoryId || w.categoryId === options.categoryId),
    );
    this.rng = options.rng ?? Math.random;
  }

  get poolSize(): number {
    return this.words.length;
  }

  markUsed(id: string): void {
    this.used.add(id);
  }

  next(difficulty: Difficulty): WordEntry | null {
    if (this.words.length === 0) return null;
    for (const d of fallbackOrder(difficulty)) {
      const pool = this.words.filter((w) => w.difficulty === d && !this.used.has(w.id));
      if (pool.length > 0) return this.take(pool);
    }
    // Everything has been played: start over rather than ending the game.
    this.used.clear();
    const pool = this.words.filter((w) => w.difficulty === difficulty);
    return this.take(pool.length ? pool : [...this.words]);
  }

  private take(pool: readonly WordEntry[]): WordEntry {
    const pick = pool[Math.floor(this.rng() * pool.length)];
    this.used.add(pick.id);
    return pick;
  }
}

/** Index of words by sorted letters, so we can detect alternative valid answers. */
export function buildAnagramIndex(words: readonly WordEntry[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const w of words) {
    const key = sortedLetters(w.word);
    const list = index.get(key) ?? [];
    if (!list.includes(w.word)) list.push(w.word);
    index.set(key, list);
  }
  return index;
}

/** Scramble a word so that the result never spells another valid word. */
export function scrambleForPlay(word: string, vocabulary: ReadonlySet<string>, rng?: Rng): string {
  return scrambleWord(word, rng, (candidate) => vocabulary.has(candidate));
}
