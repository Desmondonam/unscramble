import { create } from 'zustand';
import { maxSolvesInWindow } from '@/game/achievements';
import {
  BoardState,
  clearBoard,
  createBoard,
  currentAnswer,
  isComplete,
  pickRevealPosition,
  removeFromSlot,
  removeLast,
  revealPosition,
  shuffleTray,
  toggleTile,
  typeLetter as typeOnBoard,
} from '@/game/board';
import {
  DAILY_MAX_ATTEMPTS_PER_WORD,
  DEFAULT_DIFFICULTY_RULES,
  Difficulty,
  DifficultyRules,
  GameMode,
  HintType,
  checkAnswer,
  computeRunTotals,
  nextDifficulty,
} from '@/game/core';
import { WordPicker, scrambleForPlay } from '@/game/picker';
import type { WordEntry } from '@/game/words';
import { DEFAULT_REMOTE_CONFIG, RemoteConfig } from '@/config/remoteConfig';
import { track } from '@/lib/analytics';
import type { DailyPuzzle } from './contentStore';
import { PlayedRound, RunReward, RunSummary, useProgress } from './progressStore';

export interface StartOptions {
  mode: GameMode;
  difficulty: Difficulty;
  categoryId?: string | null;
  timedDuration?: number;
  progressive?: boolean;
  daily?: DailyPuzzle;
  /** Everything the session needs from the content/auth stores, injected for testability. */
  words: WordEntry[];
  vocabulary: ReadonlySet<string>;
  rules?: DifficultyRules;
  config?: RemoteConfig;
  isPremium?: boolean;
  excludedCategoryIds?: string[];
  now?: number;
}

export type Feedback =
  | { kind: 'correct'; points: number; word: string; alternative: boolean; streak: number; lifeRestored: boolean; id: number }
  | { kind: 'wrong'; penaltySeconds: number; livesLeft: number | null; attemptsLeft: number | null; id: number }
  | { kind: 'revealed'; word: string; reason: 'skipped' | 'outOfAttempts'; id: number };

export type HintResult = { ok: true; message: string; via: 'free' | 'coins' | 'premium'; cost: number } | { ok: false; message: string };

interface ActiveWord {
  entry: WordEntry;
  scrambled: string;
  startedAt: number;
  hints: HintType[];
  wrongAttempts: number;
}

export type Phase = 'idle' | 'playing' | 'feedback' | 'finished';

interface GameState {
  phase: Phase;
  mode: GameMode;
  difficulty: Difficulty;
  currentDifficulty: Difficulty;
  categoryId: string | null;
  progressive: boolean;
  timedDuration: number;
  dailyDate: string | null;
  board: BoardState | null;
  current: ActiveWord | null;
  rounds: PlayedRound[];
  score: number;
  streak: number;
  startedAt: number;
  deadline: number | null;
  feedback: Feedback | null;
  result: { run: RunSummary; reward: RunReward } | null;
  runId: string;

  start: (options: StartOptions) => boolean;
  tapTile: (tileId: number) => void;
  tapSlot: (slotIndex: number) => void;
  typeLetter: (letter: string) => void;
  backspace: () => void;
  clear: () => void;
  shuffle: () => void;
  applyHint: (hint: HintType) => HintResult;
  submit: (now?: number) => Feedback | null;
  skip: (now?: number) => Feedback | null;
  advance: (now?: number) => void;
  tick: (now?: number) => void;
  finish: (reason: RunSummary['endReason'], now?: number) => void;
  reset: () => void;
}

// Session-scoped dependencies that should not live in React state.
let picker: WordPicker | null = null;
let vocabulary: ReadonlySet<string> = new Set();
let rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES;
let config: RemoteConfig = DEFAULT_REMOTE_CONFIG;
let isPremium = false;
let dailyQueue: { words: WordEntry[]; scrambles: string[] } | null = null;
let feedbackId = 0;

const usesLives = (mode: GameMode) => mode === 'classic' || mode === 'categories';

function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const IDLE = {
  phase: 'idle' as Phase,
  mode: 'classic' as GameMode,
  difficulty: 'easy' as Difficulty,
  currentDifficulty: 'easy' as Difficulty,
  categoryId: null as string | null,
  progressive: false,
  timedDuration: 60,
  dailyDate: null as string | null,
  board: null as BoardState | null,
  current: null as ActiveWord | null,
  rounds: [] as PlayedRound[],
  score: 0,
  streak: 0,
  startedAt: 0,
  deadline: null as number | null,
  feedback: null as Feedback | null,
  result: null as GameState['result'],
  runId: '',
};

export const useGame = create<GameState>()((set, get) => {
  /** Load the next word, or finish the run when there are none left. */
  const loadNextWord = (now: number) => {
    const state = get();
    let entry: WordEntry | null = null;
    let scrambled = '';
    if (state.mode === 'daily') {
      const index = state.rounds.length;
      if (!dailyQueue || index >= dailyQueue.words.length) {
        get().finish('completed', now);
        return;
      }
      entry = dailyQueue.words[index];
      scrambled = dailyQueue.scrambles[index];
    } else {
      entry = picker?.next(state.currentDifficulty) ?? null;
      if (!entry) {
        get().finish('completed', now);
        return;
      }
      scrambled = scrambleForPlay(entry.word, vocabulary);
    }
    set({
      phase: 'playing',
      current: { entry, scrambled, startedAt: now, hints: [], wrongAttempts: 0 },
      board: createBoard(entry.word, scrambled),
      feedback: null,
    });
  };

  const recordRound = (solved: boolean, now: number): PlayedRound => {
    const { current } = get();
    const active = current!;
    const round: PlayedRound = {
      wordId: active.entry.id,
      word: active.entry.word,
      difficulty: active.entry.difficulty,
      categoryId: active.entry.categoryId,
      solved,
      seconds: Math.max(0, (now - active.startedAt) / 1000),
      hints: [...active.hints],
      wrongAttempts: active.wrongAttempts,
      startedAt: active.startedAt,
      endedAt: now,
    };
    const rounds = [...get().rounds, round];
    const totals = computeRunTotals(rounds, rules);
    // Run streak mirrors computeRunTotals so client and server agree exactly.
    const streak = solved ? (round.wrongAttempts > 0 ? 1 : get().streak + 1) : 0;
    set({ rounds, score: totals.score, streak });
    return round;
  };

  return {
    ...IDLE,

    start: (options) => {
      const now = options.now ?? Date.now();
      vocabulary = options.vocabulary;
      rules = options.rules ?? DEFAULT_DIFFICULTY_RULES;
      config = options.config ?? DEFAULT_REMOTE_CONFIG;
      isPremium = options.isPremium ?? false;
      dailyQueue = null;
      picker = null;

      if (options.mode === 'daily') {
        if (!options.daily || options.daily.words.length === 0) return false;
        dailyQueue = { words: options.daily.words, scrambles: options.daily.scrambles };
      } else {
        picker = new WordPicker(options.words, {
          categoryId: options.mode === 'categories' ? options.categoryId : null,
          excludedCategoryIds: options.excludedCategoryIds,
        });
        if (picker.poolSize === 0) return false;
      }

      if (usesLives(options.mode)) {
        useProgress.getState().regenerateLives(config, now);
        if (useProgress.getState().lives <= 0) return false;
      }

      const timedDuration = options.timedDuration ?? 60;
      set({
        ...IDLE,
        mode: options.mode,
        difficulty: options.difficulty,
        currentDifficulty: options.difficulty,
        categoryId: options.mode === 'categories' ? (options.categoryId ?? null) : null,
        progressive: options.mode === 'classic' && (options.progressive ?? false),
        timedDuration,
        dailyDate: options.daily?.date ?? null,
        startedAt: now,
        deadline: options.mode === 'timed' ? now + timedDuration * 1000 : null,
        runId: newRunId(),
      });
      track('game_started', { mode: options.mode, difficulty: options.difficulty, category: options.categoryId ?? null });
      loadNextWord(now);
      return true;
    },

    tapTile: (tileId) => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: toggleTile(board, tileId) });
    },

    tapSlot: (slotIndex) => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: removeFromSlot(board, slotIndex) });
    },

    typeLetter: (letter) => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: typeOnBoard(board, letter) });
    },

    backspace: () => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: removeLast(board) });
    },

    clear: () => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: clearBoard(board) });
    },

    shuffle: () => {
      const { board, phase } = get();
      if (!board || phase !== 'playing') return;
      set({ board: shuffleTray(board) });
    },

    applyHint: (hint) => {
      const { board, current, phase } = get();
      if (!board || !current || phase !== 'playing') return { ok: false, message: 'No active word.' };
      if (current.hints.includes(hint)) return { ok: false, message: 'You already used that hint for this word.' };
      const limit = rules[current.entry.difficulty].maxHintsPerWord;
      if (current.hints.length >= limit) {
        return { ok: false, message: `Only ${limit} hint${limit === 1 ? '' : 's'} allowed per ${current.entry.difficulty} word.` };
      }

      let nextBoard = board;
      let message = '';
      if (hint === 'firstLetter') {
        if (board.locked[0]) return { ok: false, message: 'The first letter is already revealed.' };
        nextBoard = revealPosition(board, 0);
        message = `It starts with “${current.entry.word[0]}”.`;
      } else if (hint === 'position') {
        const position = pickRevealPosition(board, Math.random, !board.locked[0] && !current.hints.includes('firstLetter'));
        if (position < 0) return { ok: false, message: 'Every letter is already revealed.' };
        nextBoard = revealPosition(board, position);
        message = `Letter ${position + 1} is “${current.entry.word[position]}”.`;
      } else {
        message = current.entry.definition;
      }

      const payment = useProgress.getState().payForHint(hint, isPremium, config);
      if (!payment.ok) return { ok: false, message: 'Not enough coins. Solve words or claim your daily reward to earn more.' };

      set({ board: nextBoard, current: { ...current, hints: [...current.hints, hint] } });
      track('hint_used', { hint, difficulty: current.entry.difficulty, via: payment.via });
      return { ok: true, message, via: payment.via, cost: payment.cost };
    },

    submit: (now = Date.now()) => {
      const { board, current, phase, mode } = get();
      if (!board || !current || phase !== 'playing' || !isComplete(board)) return null;
      const check = checkAnswer(currentAnswer(board), current.entry.word, vocabulary);

      if (check.correct) {
        recordRound(true, now);
        const state = get();
        let lifeRestored = false;
        if (usesLives(mode) && state.streak > 0 && state.streak % config.lifeRestoreStreak === 0) {
          const before = useProgress.getState().lives;
          useProgress.getState().gainLife(config);
          lifeRestored = useProgress.getState().lives > before;
        }
        if (state.progressive) {
          const solved = state.rounds.filter((r) => r.solved).length;
          if (solved % config.progressiveEvery === 0) set({ currentDifficulty: nextDifficulty(state.currentDifficulty) });
        }
        const perRound = computeRunTotals(get().rounds, rules).perRound;
        const points = perRound[perRound.length - 1] ?? 0;
        const fb: Feedback = {
          kind: 'correct',
          points,
          word: current.entry.word,
          alternative: !check.exact,
          streak: get().streak,
          lifeRestored,
          id: ++feedbackId,
        };
        set({ phase: 'feedback', feedback: fb });
        track('answer_correct', { mode, difficulty: current.entry.difficulty, hints: current.hints.length });
        return fb;
      }

      // Wrong answer.
      track('answer_incorrect', { mode, difficulty: current.entry.difficulty });
      const wrongAttempts = current.wrongAttempts + 1;
      set({ current: { ...current, wrongAttempts }, board: clearBoard(board), streak: 0 });

      if (mode === 'timed') {
        const penaltySeconds = rules[current.entry.difficulty].timedPenaltySeconds;
        const deadline = (get().deadline ?? now) - penaltySeconds * 1000;
        set({ deadline });
        const fb: Feedback = { kind: 'wrong', penaltySeconds, livesLeft: null, attemptsLeft: null, id: ++feedbackId };
        set({ feedback: fb });
        if (deadline <= now) get().finish('timeUp', now);
        return fb;
      }

      if (mode === 'daily') {
        const attemptsLeft = DAILY_MAX_ATTEMPTS_PER_WORD - wrongAttempts;
        if (attemptsLeft <= 0) {
          recordRound(false, now);
          const fb: Feedback = { kind: 'revealed', word: current.entry.word, reason: 'outOfAttempts', id: ++feedbackId };
          set({ phase: 'feedback', feedback: fb });
          return fb;
        }
        const fb: Feedback = { kind: 'wrong', penaltySeconds: 0, livesLeft: null, attemptsLeft, id: ++feedbackId };
        set({ feedback: fb });
        return fb;
      }

      // Classic / categories: costs a life; the player keeps trying the same word.
      const livesLeft = useProgress.getState().loseLife(config, now);
      const fb: Feedback = { kind: 'wrong', penaltySeconds: 0, livesLeft, attemptsLeft: null, id: ++feedbackId };
      set({ feedback: fb });
      if (livesLeft <= 0) {
        recordRound(false, now);
        get().finish('outOfLives', now);
      }
      return fb;
    },

    skip: (now = Date.now()) => {
      const { current, phase, mode } = get();
      if (!current || phase !== 'playing') return null;
      if (mode === 'timed') {
        const penaltySeconds = rules[current.entry.difficulty].timedPenaltySeconds;
        set({ deadline: (get().deadline ?? now) - penaltySeconds * 1000 });
      }
      recordRound(false, now);
      const fb: Feedback = { kind: 'revealed', word: current.entry.word, reason: 'skipped', id: ++feedbackId };
      set({ phase: 'feedback', feedback: fb });
      if (usesLives(mode) && useProgress.getState().loseLife(config, now) <= 0) {
        get().finish('outOfLives', now);
      } else if (mode === 'timed' && (get().deadline ?? Infinity) <= now) {
        get().finish('timeUp', now);
      }
      return fb;
    },

    advance: (now = Date.now()) => {
      if (get().phase !== 'feedback') return;
      if (get().mode === 'timed' && (get().deadline ?? Infinity) <= now) {
        get().finish('timeUp', now);
        return;
      }
      loadNextWord(now);
    },

    tick: (now = Date.now()) => {
      const { deadline, phase } = get();
      if (deadline !== null && (phase === 'playing' || phase === 'feedback') && now >= deadline) get().finish('timeUp', now);
    },

    finish: (reason, now = Date.now()) => {
      const state = get();
      if (state.phase === 'finished' || state.phase === 'idle') return;
      const end = state.deadline !== null ? Math.min(now, Math.max(state.deadline, state.startedAt)) : now;
      const totals = computeRunTotals(state.rounds, rules);
      const solvedRounds = state.rounds.filter((r) => r.solved);
      const run: RunSummary = {
        id: state.runId,
        mode: state.mode,
        difficulty: state.difficulty,
        categoryId: state.categoryId,
        startedAt: state.startedAt,
        endedAt: end,
        durationSeconds: Math.max(0, (end - state.startedAt) / 1000),
        timedDuration: state.mode === 'timed' ? state.timedDuration : undefined,
        dailyDate: state.dailyDate ?? undefined,
        rounds: state.rounds,
        score: totals.score,
        solved: totals.solved,
        attempted: totals.attempted,
        bestStreak: totals.bestStreak,
        coins: totals.coins,
        hintsUsed: state.rounds.reduce((sum, r) => sum + r.hints.length, 0),
        maxSolvedIn30s: maxSolvesInWindow(solvedRounds.map((r) => ({ start: r.startedAt, end: r.endedAt }))),
        endReason: reason,
      };

      // A daily run that was abandoned part-way is not a completion.
      const incompleteDaily = state.mode === 'daily' && reason !== 'completed';
      if (state.rounds.length === 0 || incompleteDaily) {
        set({ phase: 'finished', current: null, board: null, result: null });
        return;
      }

      const reward = useProgress.getState().recordRun(run, config);
      set({ phase: 'finished', current: null, board: null, result: { run, reward }, score: totals.score });
      track('game_completed', { mode: run.mode, score: run.score, solved: run.solved, attempted: run.attempted, reason });
      if (run.mode === 'daily') track('daily_completed', { score: run.score, solved: run.solved });
      if (reward.levelAfter > reward.levelBefore) track('level_up', { level: reward.levelAfter });
      reward.newAchievements.forEach((a) => track('achievement_unlocked', { id: a.id }));
    },

    reset: () => {
      picker = null;
      dailyQueue = null;
      set({ ...IDLE });
    },
  };
});

/** Seconds left in a timed game. */
export function timeLeft(deadline: number | null, now = Date.now()): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
