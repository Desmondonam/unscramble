import {
  DAILY_DIFFICULTY_PATTERN,
  DEFAULT_DIFFICULTY_RULES,
  RoundRecord,
  addDays,
  checkAnswer,
  computeRunTotals,
  createRng,
  dailyScramble,
  daysBetween,
  difficultyForLength,
  displayedDailyStreak,
  hintFactor,
  isAnagram,
  isValidDateKey,
  levelForXp,
  levelProgress,
  localDateKey,
  maxWordScore,
  nextDailyStreak,
  nextDifficulty,
  normalizeWord,
  scoreWord,
  scrambleWord,
  selectDailyWords,
  streakMultiplier,
  validateRun,
  xpForLevel,
} from '../core';
import { BUNDLED_WORDS } from '../words';

describe('scrambleWord', () => {
  it('keeps exactly the same letters', () => {
    for (const word of ['APPLE', 'MISSISSIPPI', 'CAT', 'HIPPOPOTAMUS']) {
      for (let i = 0; i < 50; i += 1) {
        const s = scrambleWord(word);
        expect(isAnagram(s, word)).toBe(true);
        expect(s).toHaveLength(word.length);
      }
    }
  });

  it('never returns the original word when another arrangement exists', () => {
    for (const w of BUNDLED_WORDS.slice(0, 400)) {
      expect(scrambleWord(w.word)).not.toBe(w.word);
    }
  });

  it('handles words of one repeated letter without looping forever (old bug)', () => {
    expect(scrambleWord('AAA')).toBe('AAA');
    expect(scrambleWord('ZZ')).toBe('ZZ');
  });

  it('falls back safely when the random source always produces the original', () => {
    const stuck = () => 0.999999; // Fisher–Yates with j = i keeps the order
    expect(scrambleWord('ABAB', stuck)).not.toBe('ABAB');
    expect(scrambleWord('LEMON', stuck)).not.toBe('LEMON');
  });

  it('avoids forbidden scrambles such as other valid words', () => {
    const forbidden = new Set(['MELON']);
    for (let i = 0; i < 100; i += 1) {
      expect(scrambleWord('LEMON', Math.random, (c) => forbidden.has(c))).not.toBe('MELON');
    }
  });

  it('is deterministic for a seeded generator', () => {
    expect(scrambleWord('PLANET', createRng(42))).toBe(scrambleWord('PLANET', createRng(42)));
  });
});

describe('checkAnswer', () => {
  const vocab = new Set(['LEMON', 'MELON', 'APPLE']);
  it('accepts the exact word regardless of case and spacing', () => {
    expect(checkAnswer(' apple ', 'APPLE')).toEqual({ correct: true, exact: true });
  });
  it('accepts an approved anagram as an alternative', () => {
    expect(checkAnswer('MELON', 'LEMON', vocab)).toEqual({ correct: true, exact: false });
  });
  it('rejects unapproved anagrams, wrong letters and partial answers', () => {
    expect(checkAnswer('NOMEL', 'LEMON', vocab).correct).toBe(false);
    expect(checkAnswer('APPLY', 'APPLE', vocab).correct).toBe(false);
    expect(checkAnswer('APP', 'APPLE', vocab).correct).toBe(false);
    expect(checkAnswer('', 'APPLE', vocab).correct).toBe(false);
  });
  it('normalises accents and punctuation', () => {
    expect(normalizeWord("Café-crème!")).toBe('CAFECREME');
  });
});

describe('difficulty', () => {
  it('maps lengths to difficulties', () => {
    expect(difficultyForLength(2)).toBeNull();
    expect(difficultyForLength(3)).toBe('easy');
    expect(difficultyForLength(4)).toBe('easy');
    expect(difficultyForLength(5)).toBe('medium');
    expect(difficultyForLength(6)).toBe('medium');
    expect(difficultyForLength(7)).toBe('hard');
    expect(difficultyForLength(9)).toBe('hard');
    expect(difficultyForLength(10)).toBe('expert');
    expect(difficultyForLength(14)).toBe('expert');
  });
  it('steps up progressively and caps at expert', () => {
    expect(nextDifficulty('easy')).toBe('medium');
    expect(nextDifficulty('hard')).toBe('expert');
    expect(nextDifficulty('expert')).toBe('expert');
  });
  it('gives expert fewer hints than easy', () => {
    expect(DEFAULT_DIFFICULTY_RULES.expert.maxHintsPerWord).toBeLessThan(DEFAULT_DIFFICULTY_RULES.easy.maxHintsPerWord);
  });
});

describe('scoring', () => {
  it('uses the base scores from the spec', () => {
    const slow = (word: string, d: 'easy' | 'medium' | 'hard' | 'expert') =>
      scoreWord({ word, difficulty: d, seconds: 999, streak: 1, hintsUsed: 0 });
    expect(slow('CAT', 'easy').total).toBe(10);
    expect(slow('APPLE', 'medium').total).toBe(20);
    expect(slow('DOLPHIN', 'hard').total).toBe(35);
    expect(slow('MICROPHONE', 'expert').total).toBe(50);
  });
  it('rewards longer words within a difficulty', () => {
    const a = scoreWord({ word: 'CAT', difficulty: 'easy', seconds: 999, streak: 1, hintsUsed: 0 }).total;
    const b = scoreWord({ word: 'BEAR', difficulty: 'easy', seconds: 999, streak: 1, hintsUsed: 0 }).total;
    expect(b).toBeGreaterThan(a);
  });
  it('rewards speed', () => {
    const fast = scoreWord({ word: 'APPLE', difficulty: 'medium', seconds: 2, streak: 1, hintsUsed: 0 });
    const slow = scoreWord({ word: 'APPLE', difficulty: 'medium', seconds: 20, streak: 1, hintsUsed: 0 });
    expect(fast.speedBonus).toBeGreaterThan(0);
    expect(slow.speedBonus).toBe(0);
    expect(fast.total).toBeGreaterThan(slow.total);
  });
  it('rewards streaks up to a 2x cap', () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.2);
    expect(streakMultiplier(11)).toBe(2);
    expect(streakMultiplier(50)).toBe(2);
  });
  it('penalises hints but never below the floor', () => {
    expect(hintFactor(0)).toBe(1);
    expect(hintFactor(1)).toBe(0.8);
    expect(hintFactor(10)).toBe(0.4);
    const none = scoreWord({ word: 'APPLE', difficulty: 'medium', seconds: 30, streak: 1, hintsUsed: 0 }).total;
    const two = scoreWord({ word: 'APPLE', difficulty: 'medium', seconds: 30, streak: 1, hintsUsed: 2 }).total;
    expect(two).toBeLessThan(none);
  });
  it('computes a maximum per word', () => {
    expect(maxWordScore('APPLE', 'medium')).toBe(80); // (20 base + 20 speed) * 2
  });
});

describe('progression', () => {
  it('levels up on a growing curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(4500)).toBe(10);
    expect(levelProgress(200)).toEqual({ level: 2, current: 100, needed: 200, ratio: 0.5 });
  });
});

describe('dates and daily streaks', () => {
  it('formats and validates date keys', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-1-5')).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
  });
  it('increments only on consecutive days and never twice per day', () => {
    expect(nextDailyStreak(null, 0, '2026-11-11')).toBe(1);
    expect(nextDailyStreak('2026-11-10', 4, '2026-11-11')).toBe(5);
    expect(nextDailyStreak('2026-11-11', 5, '2026-11-11')).toBe(5);
    expect(nextDailyStreak('2026-11-08', 9, '2026-11-11')).toBe(1);
  });
  it('shows a lapsed streak as zero', () => {
    expect(displayedDailyStreak('2026-11-10', 4, '2026-11-11')).toBe(4);
    expect(displayedDailyStreak('2026-11-09', 4, '2026-11-11')).toBe(0);
    expect(displayedDailyStreak(null, 0, '2026-11-11')).toBe(0);
  });
});

describe('daily challenge selection', () => {
  it('is identical for every player on the same date and follows the difficulty pattern', () => {
    const a = selectDailyWords('2026-11-11', BUNDLED_WORDS);
    const b = selectDailyWords('2026-11-11', [...BUNDLED_WORDS].reverse());
    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    expect(a.map((w) => w.difficulty)).toEqual(DAILY_DIFFICULTY_PATTERN);
    expect(new Set(a.map((w) => w.id)).size).toBe(a.length);
  });
  it('changes from day to day', () => {
    const a = selectDailyWords('2026-11-11', BUNDLED_WORDS).map((w) => w.id).join();
    const b = selectDailyWords('2026-11-12', BUNDLED_WORDS).map((w) => w.id).join();
    expect(a).not.toBe(b);
  });
  it('produces the same scramble for everyone', () => {
    expect(dailyScramble('2026-11-11', 'PLANET')).toBe(dailyScramble('2026-11-11', 'PLANET'));
    expect(dailyScramble('2026-11-11', 'PLANET')).not.toBe('PLANET');
  });
});

describe('runs', () => {
  const round = (over: Partial<RoundRecord>): RoundRecord => ({
    wordId: 'en:apple',
    word: 'APPLE',
    difficulty: 'medium',
    solved: true,
    seconds: 20,
    hints: [],
    wrongAttempts: 0,
    ...over,
  });

  it('recomputes totals with streaks reset by misses and wrong attempts', () => {
    const totals = computeRunTotals([
      round({ wordId: 'a' }),
      round({ wordId: 'b' }),
      round({ wordId: 'c', solved: false }),
      round({ wordId: 'd', wrongAttempts: 1 }),
    ]);
    expect(totals.perRound).toEqual([20, 22, 0, 20]);
    expect(totals.score).toBe(62);
    expect(totals.solved).toBe(3);
    expect(totals.bestStreak).toBe(2);
    expect(totals.coins).toBe(6);
  });

  it('accepts a plausible run', () => {
    expect(validateRun({ mode: 'classic', durationSeconds: 60, rounds: [round({ wordId: 'a' }), round({ wordId: 'b' })] })).toEqual([]);
  });

  it('flags manipulated runs', () => {
    const problems = validateRun({
      mode: 'timed',
      durationSeconds: 500,
      rounds: [
        round({ wordId: 'a', seconds: 0.1 }),
        round({ wordId: 'a', difficulty: 'easy' }),
        round({ wordId: 'c', hints: ['firstLetter', 'firstLetter', 'position', 'definition'] }),
      ],
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'round 0: implausibly fast',
        'round 1: difficulty mismatch',
        'round 1: duplicate word',
        'round 2: too many hints',
        'round 2: repeated hint',
        'timed run too long',
      ]),
    );
  });

  it('requires all daily words in a daily run', () => {
    expect(validateRun({ mode: 'daily', durationSeconds: 60, rounds: [round({})] })).toContain('daily run must contain every daily word');
  });
});
