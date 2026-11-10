import { DEFAULT_REMOTE_CONFIG } from '@/config/remoteConfig';
import { currentAnswer } from '@/game/board';
import { DAILY_DIFFICULTY_PATTERN, computeRunTotals, dailyScramble, selectDailyWords, validateRun } from '@/game/core';
import { BUNDLED_WORDS } from '@/game/words';
import { useGame } from '../gameStore';
import { useProgress } from '../progressStore';

const vocabulary = new Set(BUNDLED_WORDS.map((w) => w.word));
const T0 = 1_700_000_000_000;

/** Fill the board with the correct letters, the way a player would by tapping. */
function solveBoard() {
  const { board } = useGame.getState();
  const used = new Set<number>();
  board!.word.split('').forEach((letter, i) => {
    if (board!.locked[i]) {
      used.add(board!.slots[i]!);
      return;
    }
  });
  for (let i = 0; i < board!.word.length; i += 1) {
    const b = useGame.getState().board!;
    if (b.locked[i]) continue;
    const tile = b.tiles.find((t) => t.letter === b.word[i] && !b.slots.includes(t.id) && !used.has(t.id))!;
    useGame.getState().tapTile(tile.id);
  }
}

function fillWrong() {
  const b = useGame.getState().board!;
  // Reverse-sorted letters are never the word for these tests' purposes; ensure it differs.
  for (const tile of [...b.tiles].reverse()) if (!b.slots.includes(tile.id)) useGame.getState().tapTile(tile.id);
  if (currentAnswer(useGame.getState().board!) === b.word) {
    useGame.getState().clear();
    for (const tile of b.tiles) useGame.getState().tapTile(tile.id);
  }
}

function start(mode: 'classic' | 'timed' | 'categories', extra: Record<string, unknown> = {}) {
  return useGame.getState().start({
    mode,
    difficulty: 'medium',
    words: BUNDLED_WORDS,
    vocabulary,
    now: T0,
    ...extra,
  });
}

beforeEach(() => {
  useProgress.getState().resetProgress();
  useGame.getState().reset();
});

describe('classic mode', () => {
  it('scores a correct answer and advances to a new word', () => {
    expect(start('classic')).toBe(true);
    const first = useGame.getState().current!.entry.id;
    solveBoard();
    const fb = useGame.getState().submit(T0 + 3000)!;
    expect(fb.kind).toBe('correct');
    expect(useGame.getState().score).toBeGreaterThan(0);
    useGame.getState().advance(T0 + 4000);
    expect(useGame.getState().current!.entry.id).not.toBe(first);
  });

  it('does not submit an incomplete answer', () => {
    start('classic');
    expect(useGame.getState().submit(T0 + 1000)).toBeNull();
  });

  it('costs a life for a wrong answer and keeps the same word', () => {
    start('classic');
    const id = useGame.getState().current!.entry.id;
    fillWrong();
    const fb = useGame.getState().submit(T0 + 2000)!;
    expect(fb).toMatchObject({ kind: 'wrong', livesLeft: DEFAULT_REMOTE_CONFIG.maxLives - 1 });
    expect(useGame.getState().current!.entry.id).toBe(id);
    expect(useGame.getState().streak).toBe(0);
  });

  it('ends the game when lives run out and records the run once', () => {
    start('classic');
    for (let i = 0; i < DEFAULT_REMOTE_CONFIG.maxLives; i += 1) {
      fillWrong();
      useGame.getState().submit(T0 + 1000 * (i + 2));
    }
    const state = useGame.getState();
    expect(state.phase).toBe('finished');
    expect(state.result!.run.endReason).toBe('outOfLives');
    expect(useProgress.getState().stats.gamesPlayed).toBe(1);
    expect(useProgress.getState().lives).toBe(0);
    // Cannot start a lives-based game without lives.
    expect(start('classic')).toBe(false);
  });

  it('climbs difficulty progressively', () => {
    start('classic', { progressive: true, difficulty: 'easy' });
    for (let i = 0; i < DEFAULT_REMOTE_CONFIG.progressiveEvery; i += 1) {
      solveBoard();
      useGame.getState().submit(T0 + 5000 * (i + 1));
      useGame.getState().advance(T0 + 5000 * (i + 1) + 500);
    }
    expect(useGame.getState().currentDifficulty).toBe('medium');
    expect(useGame.getState().current!.entry.difficulty).toBe('medium');
  });

  it('restores a life through a streak', () => {
    start('classic');
    fillWrong();
    useGame.getState().submit(T0 + 1000);
    const before = useProgress.getState().lives;
    for (let i = 0; i < DEFAULT_REMOTE_CONFIG.lifeRestoreStreak + 1; i += 1) {
      solveBoard();
      useGame.getState().submit(T0 + 10_000 * (i + 1));
      useGame.getState().advance(T0 + 10_000 * (i + 1) + 500);
    }
    expect(useProgress.getState().lives).toBe(before + 1);
  });

  it('produces runs the server validator accepts with the same score', () => {
    start('classic');
    for (let i = 0; i < 4; i += 1) {
      solveBoard();
      useGame.getState().submit(T0 + 6000 * (i + 1));
      useGame.getState().advance(T0 + 6000 * (i + 1));
    }
    useGame.getState().finish('quit', T0 + 30_000);
    const run = useGame.getState().result!.run;
    expect(validateRun({ mode: run.mode, durationSeconds: run.durationSeconds, rounds: run.rounds })).toEqual([]);
    expect(computeRunTotals(run.rounds).score).toBe(run.score);
  });
});

describe('category mode', () => {
  it('only serves words from the chosen category', () => {
    start('categories', { categoryId: 'sports' });
    for (let i = 0; i < 5; i += 1) {
      expect(useGame.getState().current!.entry.categoryId).toBe('sports');
      useGame.getState().skip(T0 + i * 1000 + 1000);
      if (useGame.getState().phase === 'finished') break;
      useGame.getState().advance(T0 + i * 1000 + 1500);
    }
  });
});

describe('timed mode', () => {
  it('subtracts time for a wrong answer and ends when the clock runs out', () => {
    start('timed', { timedDuration: 60 });
    const deadline = useGame.getState().deadline!;
    fillWrong();
    const fb = useGame.getState().submit(T0 + 1000)!;
    expect(fb).toMatchObject({ kind: 'wrong', penaltySeconds: 5 });
    expect(useGame.getState().deadline).toBe(deadline - 5000);
    // No lives are used in timed mode.
    expect(useProgress.getState().lives).toBe(DEFAULT_REMOTE_CONFIG.maxLives);
    solveBoard();
    useGame.getState().submit(T0 + 4000);
    useGame.getState().tick(T0 + 56_000);
    expect(useGame.getState().phase).toBe('finished');
    expect(useGame.getState().result!.run.endReason).toBe('timeUp');
    expect(useGame.getState().result!.run.durationSeconds).toBeLessThanOrEqual(60);
  });
});

describe('daily mode', () => {
  const date = '2026-11-11';
  const daily = () => {
    const words = selectDailyWords(date, BUNDLED_WORDS);
    return { date, words, scrambles: words.map((w) => dailyScramble(date, w.word)), source: 'local' as const };
  };

  it('plays the five daily words, then rewards once', () => {
    useGame.getState().start({ mode: 'daily', difficulty: 'easy', words: BUNDLED_WORDS, vocabulary, daily: daily(), now: T0 });
    for (let i = 0; i < DAILY_DIFFICULTY_PATTERN.length; i += 1) {
      expect(useGame.getState().current!.entry.difficulty).toBe(DAILY_DIFFICULTY_PATTERN[i]);
      solveBoard();
      useGame.getState().submit(T0 + 10_000 * (i + 1));
      useGame.getState().advance(T0 + 10_000 * (i + 1) + 500);
    }
    const first = useGame.getState().result!;
    expect(first.run.endReason).toBe('completed');
    expect(useProgress.getState().stats.dailyStreak).toBe(1);
    expect(useProgress.getState().dailyHistory[date].results).toEqual(['solved', 'solved', 'solved', 'solved', 'solved']);
    const coinsAfterFirst = useProgress.getState().stats.coins;
    const xpAfterFirst = useProgress.getState().stats.xp;

    // Replaying the same date gives no rewards.
    useGame.getState().start({ mode: 'daily', difficulty: 'easy', words: BUNDLED_WORDS, vocabulary, daily: daily(), now: T0 });
    for (let i = 0; i < 5; i += 1) {
      solveBoard();
      useGame.getState().submit(T0 + 10_000 * (i + 1));
      useGame.getState().advance(T0 + 10_000 * (i + 1) + 500);
    }
    expect(useGame.getState().result!.reward.xpGained).toBe(0);
    expect(useProgress.getState().stats.coins).toBe(coinsAfterFirst);
    expect(useProgress.getState().stats.xp).toBe(xpAfterFirst);
    expect(useProgress.getState().stats.dailyCompletions).toBe(1);
  });

  it('reveals a word after three wrong attempts and does not use lives', () => {
    useGame.getState().start({ mode: 'daily', difficulty: 'easy', words: BUNDLED_WORDS, vocabulary, daily: daily(), now: T0 });
    for (let i = 0; i < 3; i += 1) {
      fillWrong();
      useGame.getState().submit(T0 + 1000 * (i + 1));
    }
    expect(useGame.getState().feedback).toMatchObject({ kind: 'revealed', reason: 'outOfAttempts' });
    expect(useGame.getState().rounds[0].solved).toBe(false);
    expect(useProgress.getState().lives).toBe(DEFAULT_REMOTE_CONFIG.maxLives);
  });

  it('does not count an abandoned daily as completed', () => {
    useGame.getState().start({ mode: 'daily', difficulty: 'easy', words: BUNDLED_WORDS, vocabulary, daily: daily(), now: T0 });
    solveBoard();
    useGame.getState().submit(T0 + 5000);
    useGame.getState().finish('quit', T0 + 6000);
    expect(useProgress.getState().dailyHistory[date]).toBeUndefined();
  });
});

describe('hints', () => {
  it('reveals the first letter, a position and the definition, respecting per-word limits', () => {
    start('classic', { difficulty: 'easy' });
    const word = useGame.getState().current!.entry.word;
    const first = useGame.getState().applyHint('firstLetter');
    expect(first.ok).toBe(true);
    expect(currentAnswer(useGame.getState().board!)[0]).toBe(word[0]);
    expect(useGame.getState().applyHint('firstLetter').ok).toBe(false);
    expect(useGame.getState().applyHint('position').ok).toBe(true);
    const def = useGame.getState().applyHint('definition');
    expect(def).toMatchObject({ ok: true, message: useGame.getState().current!.entry.definition });
    // Easy allows three hints per word.
    expect(useGame.getState().current!.hints).toHaveLength(3);
  });

  it('limits expert words to one hint', () => {
    start('classic', { difficulty: 'expert' });
    expect(useGame.getState().applyHint('definition').ok).toBe(true);
    expect(useGame.getState().applyHint('firstLetter').ok).toBe(false);
  });

  it('uses free daily hints first, then coins, then refuses', () => {
    start('classic', { difficulty: 'easy' });
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      useGame.getState().skip(T0 + 1000 * (i + 1));
      useGame.getState().advance(T0 + 1000 * (i + 1) + 1);
      results.push(useGame.getState().applyHint('definition'));
    }
    const vias = results.map((r) => (r.ok ? r.via : 'refused'));
    expect(vias.slice(0, 3)).toEqual(['free', 'free', 'free']);
    expect(vias[3]).toBe('coins');
  });

  it('is free and unlimited (within per-word limits) for premium players', () => {
    useGame.getState().start({ mode: 'timed', difficulty: 'easy', words: BUNDLED_WORDS, vocabulary, isPremium: true, now: T0 });
    for (let i = 0; i < 5; i += 1) {
      const r = useGame.getState().applyHint('definition');
      expect(r).toMatchObject({ ok: true, via: 'premium', cost: 0 });
      useGame.getState().skip(T0 + 100 * (i + 1));
      useGame.getState().advance(T0 + 100 * (i + 1) + 1);
    }
    expect(useProgress.getState().stats.coins).toBe(50);
  });
});
