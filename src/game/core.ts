/**
 * Unscramble game core — pure, dependency-free rules shared by the app and the
 * Supabase Edge Functions.
 *
 * IMPORTANT: this file is copied verbatim to `supabase/functions/_shared/core.ts`
 * by `npm run sync:shared`. A unit test fails if the two copies drift, so the
 * server always recomputes scores with exactly the same rules as the client.
 * Keep it free of imports and platform APIs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type GameMode = 'classic' | 'timed' | 'daily' | 'categories';
export type HintType = 'firstLetter' | 'position' | 'definition';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
export const GAME_MODES: GameMode[] = ['classic', 'timed', 'daily', 'categories'];
export const HINT_TYPES: HintType[] = ['firstLetter', 'position', 'definition'];

export interface DifficultyRule {
  minLength: number;
  maxLength: number;
  baseScore: number;
  /** Maximum hints a player may use on a single word. */
  maxHintsPerWord: number;
  /** Seconds removed from the clock for a wrong answer in Timed mode. */
  timedPenaltySeconds: number;
  /** Solving faster than this earns a speed bonus. */
  parSeconds: number;
  /** Coins earned for solving a word. */
  coinReward: number;
}

export type DifficultyRules = Record<Difficulty, DifficultyRule>;

export const DEFAULT_DIFFICULTY_RULES: DifficultyRules = {
  easy: { minLength: 3, maxLength: 4, baseScore: 10, maxHintsPerWord: 3, timedPenaltySeconds: 3, parSeconds: 10, coinReward: 1 },
  medium: { minLength: 5, maxLength: 6, baseScore: 20, maxHintsPerWord: 3, timedPenaltySeconds: 5, parSeconds: 15, coinReward: 2 },
  hard: { minLength: 7, maxLength: 9, baseScore: 35, maxHintsPerWord: 2, timedPenaltySeconds: 7, parSeconds: 25, coinReward: 3 },
  expert: { minLength: 10, maxLength: 99, baseScore: 50, maxHintsPerWord: 1, timedPenaltySeconds: 10, parSeconds: 40, coinReward: 5 },
};

export const SCORING = {
  /** Extra points per letter above the difficulty's minimum length. */
  lengthBonusPerLetter: 3,
  /** Speed bonus is up to this fraction of the base score. */
  maxSpeedBonusRatio: 1,
  /** Each streak step adds this to the multiplier… */
  streakStep: 0.1,
  /** …up to this many steps (so the multiplier caps at 2x). */
  maxStreakSteps: 10,
  /** Each hint removes this fraction of the word's points… */
  hintPenaltyRatio: 0.2,
  /** …but a solved word is always worth at least this fraction. */
  minHintFactor: 0.4,
} as const;

/** Coin cost of each hint for free players. Premium players pay nothing. */
export const HINT_COIN_COST: Record<HintType, number> = {
  firstLetter: 5,
  position: 10,
  definition: 8,
};

export const TIMED_DURATIONS = [30, 60, 90] as const;
export const DEFAULT_TIMED_DURATION = 60;
export const DAILY_DIFFICULTY_PATTERN: Difficulty[] = ['easy', 'medium', 'medium', 'hard', 'expert'];
export const DAILY_MAX_ATTEMPTS_PER_WORD = 3;

// ---------------------------------------------------------------------------
// Difficulty helpers
// ---------------------------------------------------------------------------

export function difficultyForLength(length: number, rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): Difficulty | null {
  for (const d of DIFFICULTIES) {
    const r = rules[d];
    if (length >= r.minLength && length <= r.maxLength) return d;
  }
  return null;
}

export function nextDifficulty(d: Difficulty): Difficulty {
  const i = DIFFICULTIES.indexOf(d);
  return DIFFICULTIES[Math.min(i + 1, DIFFICULTIES.length - 1)];
}

// ---------------------------------------------------------------------------
// Deterministic randomness (used for daily challenges and tests)
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** FNV-1a 32-bit string hash. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — small, fast and good enough for puzzles. */
export function createRng(seed: number | string): Rng {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Scrambling and validation
// ---------------------------------------------------------------------------

export function normalizeWord(value: string): string {
  return value
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function sortedLetters(word: string): string {
  return normalizeWord(word).split('').sort().join('');
}

export function isAnagram(a: string, b: string): boolean {
  return sortedLetters(a) === sortedLetters(b);
}

/**
 * Scramble a word. The result always uses exactly the word's letters, and it
 * differs from the original whenever that is possible (a word made of a
 * single repeated letter cannot be scrambled). `isForbidden` lets callers
 * avoid scrambles that spell another valid word.
 */
export function scrambleWord(
  word: string,
  rng: Rng = Math.random,
  isForbidden: (candidate: string) => boolean = () => false,
): string {
  const letters = normalizeWord(word).split('');
  const original = letters.join('');
  if (new Set(letters).size <= 1) return original;

  const bad = (candidate: string) => candidate === original || isForbidden(candidate);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const copy = [...letters];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    const candidate = copy.join('');
    if (!bad(candidate)) return candidate;
  }

  // Deterministic fallback: some rotation is guaranteed to differ from the
  // original because the word has at least two distinct letters.
  let fallback = original;
  for (let shift = 1; shift < original.length; shift += 1) {
    const rotated = original.slice(shift) + original.slice(0, shift);
    if (!bad(rotated)) return rotated;
    if (rotated !== original && fallback === original) fallback = rotated;
  }
  return fallback;
}

export interface AnswerCheck {
  correct: boolean;
  /** True when the answer is the intended word, false for an accepted alternative. */
  exact: boolean;
}

/**
 * An answer is correct when it is the target word, or when it is another word
 * from the approved vocabulary that uses exactly the same letters
 * (e.g. LEMON / MELON). Anything outside the vocabulary is rejected.
 */
export function checkAnswer(answer: string, target: string, vocabulary?: ReadonlySet<string>): AnswerCheck {
  const a = normalizeWord(answer);
  const t = normalizeWord(target);
  if (a.length === 0 || a.length !== t.length) return { correct: false, exact: false };
  if (a === t) return { correct: true, exact: true };
  if (vocabulary && vocabulary.has(a) && isAnagram(a, t)) return { correct: true, exact: false };
  return { correct: false, exact: false };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoreInput {
  word: string;
  difficulty: Difficulty;
  seconds: number;
  /** Consecutive correct answers including this one (1 for the first). */
  streak: number;
  hintsUsed: number;
}

export interface ScoreBreakdown {
  base: number;
  lengthBonus: number;
  speedBonus: number;
  streakMultiplier: number;
  hintFactor: number;
  total: number;
}

export function streakMultiplier(streak: number): number {
  const steps = Math.min(Math.max(streak - 1, 0), SCORING.maxStreakSteps);
  return Math.round((1 + steps * SCORING.streakStep) * 100) / 100;
}

export function hintFactor(hintsUsed: number): number {
  return Math.max(SCORING.minHintFactor, 1 - Math.max(0, hintsUsed) * SCORING.hintPenaltyRatio);
}

export function scoreWord(input: ScoreInput, rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): ScoreBreakdown {
  const rule = rules[input.difficulty];
  const length = normalizeWord(input.word).length;
  const base = rule.baseScore;
  const lengthBonus = Math.max(0, length - rule.minLength) * SCORING.lengthBonusPerLetter;
  const seconds = Math.max(0, input.seconds);
  const speedRatio = seconds >= rule.parSeconds ? 0 : (rule.parSeconds - seconds) / rule.parSeconds;
  const speedBonus = Math.round(base * SCORING.maxSpeedBonusRatio * speedRatio);
  const multiplier = streakMultiplier(input.streak);
  const factor = hintFactor(input.hintsUsed);
  const total = Math.round((base + lengthBonus + speedBonus) * multiplier * factor);
  return { base, lengthBonus, speedBonus, streakMultiplier: multiplier, hintFactor: factor, total };
}

/** Upper bound for a single word — used by server-side plausibility checks. */
export function maxWordScore(word: string, difficulty: Difficulty, rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): number {
  return scoreWord({ word, difficulty, seconds: 0, streak: SCORING.maxStreakSteps + 1, hintsUsed: 0 }, rules).total;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/** Total XP needed to reach `level` (level 1 needs 0 XP). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * l;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  const current = xp - start;
  const needed = end - start;
  return { level, current, needed, ratio: needed === 0 ? 0 : current / needed };
}

// ---------------------------------------------------------------------------
// Dates and daily challenge
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for the given date in the player's local time zone. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export interface DailyCandidate {
  id: string;
  word: string;
  difficulty: Difficulty;
}

/**
 * Pick the daily puzzle for a date. Every player with the same word list gets
 * the same words in the same order. The server materialises the result in
 * `daily_challenges` so later word-list edits cannot change a past day.
 */
export function selectDailyWords<T extends DailyCandidate>(dateKey: string, words: readonly T[]): T[] {
  const rng = createRng(`unscramble-daily-v1:${dateKey}`);
  const sorted = [...words].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const chosen: T[] = [];
  const used = new Set<string>();
  for (const difficulty of DAILY_DIFFICULTY_PATTERN) {
    let pool = sorted.filter((w) => w.difficulty === difficulty && !used.has(w.id));
    if (pool.length === 0) pool = sorted.filter((w) => !used.has(w.id));
    if (pool.length === 0) break;
    const pick = pool[Math.floor(rng() * pool.length)];
    used.add(pick.id);
    chosen.push(pick);
  }
  return chosen;
}

/** Scramble that is identical for every player on a given day. */
export function dailyScramble(dateKey: string, word: string, isForbidden?: (candidate: string) => boolean): string {
  return scrambleWord(word, createRng(`unscramble-daily-scramble-v1:${dateKey}:${word}`), isForbidden);
}

/**
 * Advance a daily streak when the challenge for `dateKey` is completed.
 * Returns the unchanged streak when the same day is completed twice.
 */
export function nextDailyStreak(lastDate: string | null, currentStreak: number, dateKey: string): number {
  if (!lastDate) return 1;
  const gap = daysBetween(lastDate, dateKey);
  if (gap === 0) return currentStreak;
  if (gap === 1) return currentStreak + 1;
  return 1;
}

/** The streak to display today: it lapses once a whole day is missed. */
export function displayedDailyStreak(lastDate: string | null, streak: number, todayKey: string): number {
  if (!lastDate) return 0;
  return daysBetween(lastDate, todayKey) <= 1 ? streak : 0;
}

// ---------------------------------------------------------------------------
// Runs (a single game) — scoring and server-side plausibility validation
// ---------------------------------------------------------------------------

export interface RoundRecord {
  wordId: string;
  word: string;
  difficulty: Difficulty;
  solved: boolean;
  seconds: number;
  hints: HintType[];
  wrongAttempts: number;
}

export interface RunTotals {
  score: number;
  solved: number;
  attempted: number;
  bestStreak: number;
  coins: number;
  perRound: number[];
}

/** Recompute a run's score from its rounds. The client and the server both use this. */
export function computeRunTotals(rounds: readonly RoundRecord[], rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): RunTotals {
  let streak = 0;
  let bestStreak = 0;
  let score = 0;
  let coins = 0;
  let solved = 0;
  const perRound: number[] = [];
  for (const round of rounds) {
    if (round.solved) {
      // A wrong attempt on a word breaks the streak before it is solved.
      streak = round.wrongAttempts > 0 ? 1 : streak + 1;
      bestStreak = Math.max(bestStreak, streak);
      const points = scoreWord(
        { word: round.word, difficulty: round.difficulty, seconds: round.seconds, streak, hintsUsed: round.hints.length },
        rules,
      ).total;
      score += points;
      coins += rules[round.difficulty].coinReward;
      solved += 1;
      perRound.push(points);
    } else {
      streak = 0;
      perRound.push(0);
    }
  }
  return { score, solved, attempted: rounds.length, bestStreak, coins, perRound };
}

/** Minimum believable time to solve a word: no human taps 12 tiles in 0.2s. */
export function minimumSolveSeconds(word: string): number {
  return Math.max(0.6, normalizeWord(word).length * 0.12);
}

export interface RunValidationInput {
  mode: GameMode;
  durationSeconds: number;
  timedDuration?: number;
  rounds: readonly RoundRecord[];
}

export const MAX_ROUNDS_PER_RUN = 300;

/** Returns a list of problems. An empty list means the run looks legitimate. */
export function validateRun(input: RunValidationInput, rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): string[] {
  const problems: string[] = [];
  if (!GAME_MODES.includes(input.mode)) problems.push('unknown mode');
  if (input.rounds.length === 0) problems.push('no rounds');
  if (input.rounds.length > MAX_ROUNDS_PER_RUN) problems.push('too many rounds');
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) problems.push('invalid duration');

  let roundSeconds = 0;
  const seen = new Set<string>();
  input.rounds.forEach((round, i) => {
    const length = normalizeWord(round.word).length;
    if (length !== round.word.length) problems.push(`round ${i}: invalid word`);
    if (difficultyForLength(length, rules) !== round.difficulty) problems.push(`round ${i}: difficulty mismatch`);
    if (seen.has(round.wordId)) problems.push(`round ${i}: duplicate word`);
    seen.add(round.wordId);
    if (!Number.isFinite(round.seconds) || round.seconds < 0) problems.push(`round ${i}: invalid time`);
    if (round.solved && round.seconds < minimumSolveSeconds(round.word)) problems.push(`round ${i}: implausibly fast`);
    if (round.hints.length > rules[round.difficulty].maxHintsPerWord) problems.push(`round ${i}: too many hints`);
    if (new Set(round.hints).size !== round.hints.length) problems.push(`round ${i}: repeated hint`);
    if (round.hints.some((h) => !HINT_TYPES.includes(h))) problems.push(`round ${i}: unknown hint`);
    if (!Number.isInteger(round.wrongAttempts) || round.wrongAttempts < 0) problems.push(`round ${i}: invalid attempts`);
    roundSeconds += Math.max(0, round.seconds);
  });

  // Round times must fit inside the reported game duration (with slack for
  // animations and rounding).
  if (roundSeconds > input.durationSeconds + 5 + input.rounds.length) problems.push('round times exceed duration');
  if (input.mode === 'timed') {
    const limit = (input.timedDuration ?? DEFAULT_TIMED_DURATION) + 10;
    if (input.durationSeconds > limit) problems.push('timed run too long');
  }
  if (input.mode === 'daily' && input.rounds.length !== DAILY_DIFFICULTY_PATTERN.length) {
    problems.push('daily run must contain every daily word');
  }
  return problems;
}
