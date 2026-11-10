import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ACHIEVEMENTS, Achievement, AchievementStats, evaluateAchievements } from '@/game/achievements';
import {
  Difficulty,
  GameMode,
  HINT_COIN_COST,
  HintType,
  RoundRecord,
  levelForXp,
  localDateKey,
  nextDailyStreak,
} from '@/game/core';
import { DEFAULT_REMOTE_CONFIG, RemoteConfig } from '@/config/remoteConfig';
import { AVATARS, TILE_THEMES, TileTheme } from '@/theme/tokens';
import { persistStorage } from './storage';

export interface PlayedRound extends RoundRecord {
  categoryId: string;
  startedAt: number;
  endedAt: number;
}

export interface RunSummary {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  categoryId: string | null;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  timedDuration?: number;
  dailyDate?: string;
  rounds: PlayedRound[];
  score: number;
  solved: number;
  attempted: number;
  bestStreak: number;
  coins: number;
  hintsUsed: number;
  maxSolvedIn30s: number;
  endReason: 'completed' | 'timeUp' | 'outOfLives' | 'quit';
}

export interface DailyRecord {
  date: string;
  score: number;
  results: ('solved' | 'failed')[];
  hintsUsed: number;
  durationSeconds: number;
}

export interface Stats {
  xp: number;
  coins: number;
  gamesPlayed: number;
  wordsSolved: number;
  wordsAttempted: number;
  bestScore: number;
  bestTimedScore: number;
  currentStreak: number;
  bestStreak: number;
  dailyStreak: number;
  longestDailyStreak: number;
  lastDailyDate: string | null;
  dailyCompletions: number;
  expertSolved: number;
  categoriesSolved: string[];
  hintsUsed: number;
  totalSeconds: number;
}

export interface RunReward {
  xpGained: number;
  coinsGained: number;
  levelBefore: number;
  levelAfter: number;
  newAchievements: Achievement[];
}

export type HintPayment = { ok: true; via: 'free' | 'coins' | 'premium'; cost: number } | { ok: false; reason: 'noCoins' };

export interface ProgressState {
  username: string;
  avatarId: string;
  tileThemeId: string;
  stats: Stats;
  lives: number;
  livesUpdatedAt: number;
  achievements: Record<string, string>;
  dailyHistory: Record<string, DailyRecord>;
  lastDailyRewardDate: string | null;
  dailyRewardStreak: number;
  freeHintsDate: string | null;
  freeHintsUsed: number;
  unlockedThemes: string[];
  unlockedAvatars: string[];
  pendingRuns: RunSummary[];
  lastRun: RunSummary | null;
  lastReward: RunReward | null;

  regenerateLives: (config?: RemoteConfig, now?: number) => void;
  loseLife: (config?: RemoteConfig, now?: number) => number;
  gainLife: (config?: RemoteConfig) => void;
  payForHint: (hint: HintType, isPremium: boolean, config?: RemoteConfig, now?: Date) => HintPayment;
  freeHintsLeft: (config?: RemoteConfig, now?: Date) => number;
  recordRun: (run: RunSummary, config?: RemoteConfig) => RunReward;
  claimDailyReward: (config?: RemoteConfig, now?: Date) => number;
  canClaimDailyReward: (now?: Date) => boolean;
  unlockTheme: (theme: TileTheme, isPremium: boolean) => boolean;
  unlockAvatar: (avatarId: string, isPremium: boolean) => boolean;
  setProfile: (patch: Partial<Pick<ProgressState, 'username' | 'avatarId' | 'tileThemeId'>>) => void;
  dequeueRun: (id: string) => void;
  resetProgress: () => void;
  importCloudState: (state: Partial<CloudState>) => void;
}

/** The subset of progress synchronised to `player_state` for signed-in users. */
export type CloudState = Pick<
  ProgressState,
  | 'username'
  | 'avatarId'
  | 'tileThemeId'
  | 'stats'
  | 'achievements'
  | 'dailyHistory'
  | 'unlockedThemes'
  | 'unlockedAvatars'
  | 'lastDailyRewardDate'
  | 'dailyRewardStreak'
>;

const EMPTY_STATS: Stats = {
  xp: 0,
  coins: 50,
  gamesPlayed: 0,
  wordsSolved: 0,
  wordsAttempted: 0,
  bestScore: 0,
  bestTimedScore: 0,
  currentStreak: 0,
  bestStreak: 0,
  dailyStreak: 0,
  longestDailyStreak: 0,
  lastDailyDate: null,
  dailyCompletions: 0,
  expertSolved: 0,
  categoriesSolved: [],
  hintsUsed: 0,
  totalSeconds: 0,
};

function initialState(now = Date.now()) {
  return {
    username: '',
    avatarId: 'fox',
    tileThemeId: 'sunny',
    stats: { ...EMPTY_STATS },
    lives: DEFAULT_REMOTE_CONFIG.maxLives,
    livesUpdatedAt: now,
    achievements: {} as Record<string, string>,
    dailyHistory: {} as Record<string, DailyRecord>,
    lastDailyRewardDate: null as string | null,
    dailyRewardStreak: 0,
    freeHintsDate: null as string | null,
    freeHintsUsed: 0,
    unlockedThemes: TILE_THEMES.filter((t) => t.unlock.type === 'free').map((t) => t.id),
    unlockedAvatars: AVATARS.filter((a) => a.unlock.type === 'free').map((a) => a.id),
    pendingRuns: [] as RunSummary[],
    lastRun: null as RunSummary | null,
    lastReward: null as RunReward | null,
  };
}

export function toAchievementStats(stats: Stats): AchievementStats {
  return {
    wordsSolved: stats.wordsSolved,
    bestStreak: stats.bestStreak,
    dailyCompletions: stats.dailyCompletions,
    longestDailyStreak: stats.longestDailyStreak,
    expertSolved: stats.expertSolved,
    categoriesSolved: stats.categoriesSolved,
    bestTimedScore: stats.bestTimedScore,
    xp: stats.xp,
    gamesPlayed: stats.gamesPlayed,
  };
}

export function isUnlockedByLevel(unlock: TileTheme['unlock'], level: number, isPremium: boolean): boolean {
  if (unlock.type === 'free') return true;
  if (unlock.type === 'level') return level >= unlock.level;
  if (unlock.type === 'premium') return isPremium;
  return false;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      regenerateLives: (config = DEFAULT_REMOTE_CONFIG, now = Date.now()) => {
        const { lives, livesUpdatedAt } = get();
        if (lives >= config.maxLives) {
          if (lives > config.maxLives) set({ lives: config.maxLives });
          set({ livesUpdatedAt: now });
          return;
        }
        const period = config.lifeRegenMinutes * 60_000;
        const earned = Math.floor((now - livesUpdatedAt) / period);
        if (earned <= 0) return;
        const next = Math.min(config.maxLives, lives + earned);
        set({ lives: next, livesUpdatedAt: next >= config.maxLives ? now : livesUpdatedAt + earned * period });
      },

      loseLife: (config = DEFAULT_REMOTE_CONFIG, now = Date.now()) => {
        const { lives } = get();
        const next = Math.max(0, lives - 1);
        // Start the regeneration clock when dropping below the maximum.
        set({ lives: next, livesUpdatedAt: lives >= config.maxLives ? now : get().livesUpdatedAt });
        return next;
      },

      gainLife: (config = DEFAULT_REMOTE_CONFIG) => {
        set((s) => ({ lives: Math.min(config.maxLives, s.lives + 1) }));
      },

      freeHintsLeft: (config = DEFAULT_REMOTE_CONFIG, now = new Date()) => {
        const { freeHintsDate, freeHintsUsed } = get();
        const used = freeHintsDate === localDateKey(now) ? freeHintsUsed : 0;
        return Math.max(0, config.freeHintsPerDay - used);
      },

      payForHint: (hint, isPremium, config = DEFAULT_REMOTE_CONFIG, now = new Date()) => {
        if (isPremium && config.premiumUnlimitedHints) return { ok: true, via: 'premium', cost: 0 };
        const today = localDateKey(now);
        const state = get();
        const used = state.freeHintsDate === today ? state.freeHintsUsed : 0;
        if (used < config.freeHintsPerDay) {
          set({ freeHintsDate: today, freeHintsUsed: used + 1 });
          return { ok: true, via: 'free', cost: 0 };
        }
        const cost = HINT_COIN_COST[hint];
        if (state.stats.coins < cost) return { ok: false, reason: 'noCoins' };
        set({ stats: { ...state.stats, coins: state.stats.coins - cost } });
        return { ok: true, via: 'coins', cost };
      },

      recordRun: (run, config = DEFAULT_REMOTE_CONFIG) => {
        const state = get();
        const stats: Stats = { ...state.stats, categoriesSolved: [...state.stats.categoriesSolved] };
        const levelBefore = levelForXp(stats.xp);
        let coinsGained = run.coins;

        // Streaks continue across games until a miss.
        for (const round of run.rounds) {
          if (round.solved) {
            stats.currentStreak = round.wrongAttempts > 0 ? 1 : stats.currentStreak + 1;
            stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
            if (round.difficulty === 'expert') stats.expertSolved += 1;
            if (!stats.categoriesSolved.includes(round.categoryId)) stats.categoriesSolved.push(round.categoryId);
          } else {
            stats.currentStreak = 0;
          }
        }

        stats.gamesPlayed += 1;
        stats.wordsSolved += run.solved;
        stats.wordsAttempted += run.attempted;
        stats.hintsUsed += run.hintsUsed;
        stats.totalSeconds += Math.round(run.durationSeconds);
        stats.bestScore = Math.max(stats.bestScore, run.score);
        if (run.mode === 'timed') stats.bestTimedScore = Math.max(stats.bestTimedScore, run.score);

        let dailyHistory = state.dailyHistory;
        let xpGained = run.score;
        if (run.mode === 'daily' && run.dailyDate) {
          if (dailyHistory[run.dailyDate]) {
            // Duplicate daily completion: no rewards a second time.
            xpGained = 0;
            coinsGained = 0;
          } else {
            const streak = nextDailyStreak(stats.lastDailyDate, stats.dailyStreak, run.dailyDate);
            stats.dailyStreak = streak;
            stats.longestDailyStreak = Math.max(stats.longestDailyStreak, streak);
            stats.lastDailyDate = run.dailyDate;
            stats.dailyCompletions += 1;
            coinsGained += config.dailyChallengeCoins;
            dailyHistory = {
              ...dailyHistory,
              [run.dailyDate]: {
                date: run.dailyDate,
                score: run.score,
                results: run.rounds.map((r) => (r.solved ? 'solved' : 'failed')),
                hintsUsed: run.hintsUsed,
                durationSeconds: Math.round(run.durationSeconds),
              },
            };
          }
        }

        stats.xp += xpGained;
        stats.coins += coinsGained;

        const newAchievements = evaluateAchievements(toAchievementStats(stats), state.achievements, {
          maxSolvedIn30s: run.maxSolvedIn30s,
          solved: run.solved,
          hintsUsed: run.hintsUsed,
        });
        const unlockedAt = new Date().toISOString();
        const achievements = { ...state.achievements };
        for (const a of newAchievements) {
          achievements[a.id] = unlockedAt;
          stats.coins += a.coinReward;
          coinsGained += a.coinReward;
        }

        const levelAfter = levelForXp(stats.xp);
        const unlockedThemes = new Set(state.unlockedThemes);
        TILE_THEMES.forEach((t) => t.unlock.type === 'level' && levelAfter >= t.unlock.level && unlockedThemes.add(t.id));
        const unlockedAvatars = new Set(state.unlockedAvatars);
        AVATARS.forEach((a) => a.unlock.type === 'level' && levelAfter >= a.unlock.level && unlockedAvatars.add(a.id));

        const reward: RunReward = { xpGained, coinsGained, levelBefore, levelAfter, newAchievements };
        set({
          stats,
          achievements,
          dailyHistory,
          unlockedThemes: [...unlockedThemes],
          unlockedAvatars: [...unlockedAvatars],
          pendingRuns: [...state.pendingRuns, run].slice(-50),
          lastRun: run,
          lastReward: reward,
        });
        return reward;
      },

      canClaimDailyReward: (now = new Date()) => get().lastDailyRewardDate !== localDateKey(now),

      claimDailyReward: (config = DEFAULT_REMOTE_CONFIG, now = new Date()) => {
        const state = get();
        const today = localDateKey(now);
        if (state.lastDailyRewardDate === today) return 0;
        const streak = nextDailyStreak(state.lastDailyRewardDate, state.dailyRewardStreak, today);
        const table = config.dailyRewardCoins;
        const amount = table[Math.min(streak, table.length) - 1];
        set({
          lastDailyRewardDate: today,
          dailyRewardStreak: streak,
          stats: { ...state.stats, coins: state.stats.coins + amount },
        });
        return amount;
      },

      unlockTheme: (theme, isPremium) => {
        const state = get();
        if (state.unlockedThemes.includes(theme.id)) return true;
        const level = levelForXp(state.stats.xp);
        if (isUnlockedByLevel(theme.unlock, level, isPremium)) {
          set({ unlockedThemes: [...state.unlockedThemes, theme.id] });
          return true;
        }
        if (theme.unlock.type === 'coins' && state.stats.coins >= theme.unlock.cost) {
          set({
            unlockedThemes: [...state.unlockedThemes, theme.id],
            stats: { ...state.stats, coins: state.stats.coins - theme.unlock.cost },
          });
          return true;
        }
        return false;
      },

      unlockAvatar: (avatarId, isPremium) => {
        const state = get();
        const avatar = AVATARS.find((a) => a.id === avatarId);
        if (!avatar) return false;
        if (state.unlockedAvatars.includes(avatarId)) return true;
        const level = levelForXp(state.stats.xp);
        if (isUnlockedByLevel(avatar.unlock, level, isPremium)) {
          set({ unlockedAvatars: [...state.unlockedAvatars, avatarId] });
          return true;
        }
        if (avatar.unlock.type === 'coins' && state.stats.coins >= avatar.unlock.cost) {
          set({
            unlockedAvatars: [...state.unlockedAvatars, avatarId],
            stats: { ...state.stats, coins: state.stats.coins - avatar.unlock.cost },
          });
          return true;
        }
        return false;
      },

      setProfile: (patch) => set(patch),

      dequeueRun: (id) => set((s) => ({ pendingRuns: s.pendingRuns.filter((r) => r.id !== id) })),

      resetProgress: () => set(initialState()),

      importCloudState: (cloud) => {
        const state = get();
        // Merge conservatively: never lose progress that exists on either side.
        const stats = cloud.stats ? mergeStats(state.stats, cloud.stats) : state.stats;
        set({
          username: cloud.username || state.username,
          avatarId: cloud.avatarId || state.avatarId,
          tileThemeId: cloud.tileThemeId || state.tileThemeId,
          stats,
          achievements: { ...(cloud.achievements ?? {}), ...state.achievements },
          dailyHistory: { ...(cloud.dailyHistory ?? {}), ...state.dailyHistory },
          unlockedThemes: [...new Set([...state.unlockedThemes, ...(cloud.unlockedThemes ?? [])])],
          unlockedAvatars: [...new Set([...state.unlockedAvatars, ...(cloud.unlockedAvatars ?? [])])],
          lastDailyRewardDate: maxDate(state.lastDailyRewardDate, cloud.lastDailyRewardDate ?? null),
          dailyRewardStreak: Math.max(state.dailyRewardStreak, cloud.dailyRewardStreak ?? 0),
        });
      },
    }),
    {
      name: 'unscramble-progress-v2',
      storage: persistStorage,
      version: 2,
      partialize: (s) => {
        // Functions are not persisted; everything else is.
        const { lastReward: _lastReward, ...rest } = s;
        return rest as unknown as ProgressState;
      },
    },
  ),
);

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function mergeStats(local: Stats, cloud: Partial<Stats>): Stats {
  const merged: Stats = { ...local };
  const numericKeys: (keyof Stats)[] = [
    'xp',
    'coins',
    'gamesPlayed',
    'wordsSolved',
    'wordsAttempted',
    'bestScore',
    'bestTimedScore',
    'bestStreak',
    'longestDailyStreak',
    'dailyCompletions',
    'expertSolved',
    'hintsUsed',
    'totalSeconds',
  ];
  for (const key of numericKeys) {
    const value = cloud[key];
    if (typeof value === 'number') (merged as unknown as Record<string, number>)[key] = Math.max(local[key] as number, value);
  }
  const lastDaily = maxDate(local.lastDailyDate, cloud.lastDailyDate ?? null);
  merged.lastDailyDate = lastDaily;
  merged.dailyStreak = lastDaily === local.lastDailyDate ? local.dailyStreak : (cloud.dailyStreak ?? local.dailyStreak);
  merged.categoriesSolved = [...new Set([...local.categoriesSolved, ...(cloud.categoriesSolved ?? [])])];
  return merged;
}

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
