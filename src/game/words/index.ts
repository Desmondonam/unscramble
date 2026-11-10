import { Difficulty, difficultyForLength, normalizeWord } from '../core';
import { BUILT_IN_CATEGORIES, CategoryInfo } from './categories';
import animals from './data/animals';
import business from './data/business';
import cities from './data/cities';
import countries from './data/countries';
import education from './data/education';
import entertainment from './data/entertainment';
import food from './data/food';
import general from './data/general';
import nature from './data/nature';
import science from './data/science';
import sports from './data/sports';
import technology from './data/technology';

export interface WordEntry {
  id: string;
  word: string;
  length: number;
  categoryId: string;
  difficulty: Difficulty;
  definition: string;
  example: string;
  pronunciation?: string | null;
  language: string;
  isActive: boolean;
}

const RAW: Record<string, string> = {
  animals,
  food,
  countries,
  cities,
  technology,
  science,
  education,
  sports,
  nature,
  business,
  general,
  entertainment,
};

export function wordId(word: string, language = 'en'): string {
  return `${language}:${normalizeWord(word).toLowerCase()}`;
}

/** Parse the `WORD|definition|example` format used by the bundled data files. */
export function parseWordList(raw: string, categoryId: string, language = 'en'): WordEntry[] {
  const entries: WordEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawWord, definition = '', example = ''] = trimmed.split('|').map((part) => part.trim());
    const word = normalizeWord(rawWord);
    const difficulty = difficultyForLength(word.length);
    if (!difficulty) continue;
    entries.push({
      id: wordId(word, language),
      word,
      length: word.length,
      categoryId,
      difficulty,
      definition,
      example,
      pronunciation: null,
      language,
      isActive: true,
    });
  }
  return entries;
}

/** The curated, bundled English word bank (used offline and to seed the database). */
export const BUNDLED_WORDS: WordEntry[] = Object.entries(RAW).flatMap(([categoryId, raw]) => parseWordList(raw, categoryId));

export const BUNDLED_CATEGORIES: CategoryInfo[] = BUILT_IN_CATEGORIES;

export type { CategoryInfo };

/** Replace the word itself in an example sentence with blanks, for use as a hint. */
export function maskExample(example: string, word: string): string {
  const pattern = new RegExp(`\\b${word}\\b`, 'gi');
  return example.replace(pattern, (match) => '_'.repeat(match.length));
}
