import { ACHIEVEMENTS, AchievementStats, evaluateAchievements, maxSolvesInWindow } from '../achievements';
import { createRng } from '../core';
import { WordPicker, scrambleForPlay } from '../picker';
import { BUNDLED_WORDS } from '../words';

describe('WordPicker', () => {
  it('never repeats a word in a session while words remain (old bug: same word every round)', () => {
    const picker = new WordPicker(BUNDLED_WORDS, { rng: createRng(7) });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const w = picker.next('medium')!;
      expect(seen.has(w.id)).toBe(false);
      seen.add(w.id);
    }
  });

  it('respects the requested difficulty and category', () => {
    const picker = new WordPicker(BUNDLED_WORDS, { categoryId: 'animals', rng: createRng(1) });
    for (let i = 0; i < 10; i += 1) {
      const w = picker.next('hard')!;
      expect(w.categoryId).toBe('animals');
      expect(w.difficulty).toBe('hard');
    }
  });

  it('falls back to a neighbouring difficulty when a pool is exhausted', () => {
    const picker = new WordPicker(BUNDLED_WORDS, { categoryId: 'countries', rng: createRng(2) });
    const easy = BUNDLED_WORDS.filter((w) => w.categoryId === 'countries' && w.difficulty === 'easy').length;
    for (let i = 0; i < easy; i += 1) expect(picker.next('easy')!.difficulty).toBe('easy');
    expect(picker.next('easy')!.difficulty).toBe('medium');
  });

  it('excludes locked categories and inactive words', () => {
    const words = BUNDLED_WORDS.map((w, i) => ({ ...w, isActive: i % 2 === 0 }));
    const picker = new WordPicker(words, { excludedCategoryIds: ['animals'] });
    for (let i = 0; i < 50; i += 1) {
      const w = picker.next('easy')!;
      expect(w.categoryId).not.toBe('animals');
      expect(w.isActive).toBe(true);
    }
  });

  it('returns null for an empty pool', () => {
    expect(new WordPicker([], {}).next('easy')).toBeNull();
  });

  it('never scrambles into another valid word', () => {
    const vocab = new Set(['LEMON', 'MELON']);
    for (let i = 0; i < 100; i += 1) {
      const s = scrambleForPlay('LEMON', vocab);
      expect(vocab.has(s)).toBe(false);
    }
  });
});

describe('achievements', () => {
  const base: AchievementStats = {
    wordsSolved: 0,
    bestStreak: 0,
    dailyCompletions: 0,
    longestDailyStreak: 0,
    expertSolved: 0,
    categoriesSolved: [],
    bestTimedScore: 0,
    xp: 0,
    gamesPlayed: 0,
  };

  it('unlocks the spec examples', () => {
    const ids = (s: Partial<AchievementStats>, run?: Parameters<typeof evaluateAchievements>[2]) =>
      evaluateAchievements({ ...base, ...s }, {}, run).map((a) => a.id);
    expect(ids({ wordsSolved: 1 })).toContain('first_word');
    expect(ids({ wordsSolved: 100 })).toContain('word_master');
    expect(ids({ bestStreak: 20 })).toContain('perfect_streak');
    expect(ids({ dailyCompletions: 7 })).toContain('daily_champion');
    expect(ids({}, { maxSolvedIn30s: 5, solved: 5, hintsUsed: 1 })).toContain('speed_demon');
    expect(ids({}, { maxSolvedIn30s: 4, solved: 5, hintsUsed: 1 })).not.toContain('speed_demon');
  });

  it('does not unlock twice', () => {
    expect(evaluateAchievements({ ...base, wordsSolved: 1 }, { first_word: '2026-01-01' }).map((a) => a.id)).not.toContain('first_word');
  });

  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('counts solves inside a 30-second window', () => {
    const solves = [0, 5, 10, 15, 20].map((s) => ({ start: s * 1000, end: s * 1000 + 4000 }));
    expect(maxSolvesInWindow(solves)).toBe(5);
    expect(maxSolvesInWindow([...solves, { start: 40_000, end: 45_000 }])).toBe(5);
    expect(maxSolvesInWindow([{ start: 0, end: 31_000 }])).toBe(0);
  });
});
