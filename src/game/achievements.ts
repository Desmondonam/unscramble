import { levelForXp } from './core';

export interface AchievementStats {
  wordsSolved: number;
  bestStreak: number;
  dailyCompletions: number;
  longestDailyStreak: number;
  expertSolved: number;
  categoriesSolved: readonly string[];
  bestTimedScore: number;
  xp: number;
  gamesPlayed: number;
}

/** Facts about the game that just finished, for run-based achievements. */
export interface RunFacts {
  /** Most words solved within any 30-second window. */
  maxSolvedIn30s: number;
  solved: number;
  hintsUsed: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  coinReward: number;
  /** Progress towards the goal, 0..1. */
  progress: (stats: AchievementStats) => number;
  /** Run-based achievements unlock from facts about a single game. */
  unlockedByRun?: (run: RunFacts) => boolean;
}

const ratio = (value: number, goal: number) => Math.min(1, value / goal);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_word', title: 'First Word', description: 'Solve your first puzzle.', icon: '✨', coinReward: 10, progress: (s) => ratio(s.wordsSolved, 1) },
  { id: 'word_explorer', title: 'Word Explorer', description: 'Solve 25 words.', icon: '🧭', coinReward: 20, progress: (s) => ratio(s.wordsSolved, 25) },
  { id: 'word_master', title: 'Word Master', description: 'Solve 100 words.', icon: '🏅', coinReward: 50, progress: (s) => ratio(s.wordsSolved, 100) },
  { id: 'word_legend', title: 'Word Legend', description: 'Solve 500 words.', icon: '👑', coinReward: 150, progress: (s) => ratio(s.wordsSolved, 500) },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Solve five words in under 30 seconds.',
    icon: '⚡',
    coinReward: 40,
    progress: () => 0,
    unlockedByRun: (r) => r.maxSolvedIn30s >= 5,
  },
  { id: 'hot_streak', title: 'Hot Streak', description: 'Solve 5 words in a row.', icon: '🔥', coinReward: 15, progress: (s) => ratio(s.bestStreak, 5) },
  { id: 'perfect_streak', title: 'Perfect Streak', description: 'Solve 20 words consecutively.', icon: '💯', coinReward: 60, progress: (s) => ratio(s.bestStreak, 20) },
  { id: 'daily_champion', title: 'Daily Champion', description: 'Complete seven daily challenges.', icon: '📅', coinReward: 50, progress: (s) => ratio(s.dailyCompletions, 7) },
  { id: 'daily_devotee', title: 'Daily Devotee', description: 'Reach a 7-day daily streak.', icon: '🗓️', coinReward: 70, progress: (s) => ratio(s.longestDailyStreak, 7) },
  { id: 'expert_mind', title: 'Expert Mind', description: 'Solve 10 expert words.', icon: '🧠', coinReward: 50, progress: (s) => ratio(s.expertSolved, 10) },
  { id: 'globetrotter', title: 'Globetrotter', description: 'Solve a word in all 12 categories.', icon: '🌐', coinReward: 40, progress: (s) => ratio(s.categoriesSolved.length, 12) },
  { id: 'time_lord', title: 'Time Lord', description: 'Score 500 points in one Timed Challenge.', icon: '⏱️', coinReward: 40, progress: (s) => ratio(s.bestTimedScore, 500) },
  {
    id: 'purist',
    title: 'Purist',
    description: 'Solve 10 words in one game without hints.',
    icon: '🎯',
    coinReward: 30,
    progress: () => 0,
    unlockedByRun: (r) => r.solved >= 10 && r.hintsUsed === 0,
  },
  { id: 'level_10', title: 'Rising Star', description: 'Reach level 10.', icon: '⭐', coinReward: 75, progress: (s) => ratio(levelForXp(s.xp), 10) },
];

/** Return the ids of achievements that are newly unlocked. */
export function evaluateAchievements(
  stats: AchievementStats,
  unlocked: Readonly<Record<string, unknown>>,
  run?: RunFacts,
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => {
    if (unlocked[a.id]) return false;
    if (a.unlockedByRun) return !!run && a.unlockedByRun(run);
    return a.progress(stats) >= 1;
  });
}

/**
 * Most words solved within any `windowMs` span, measured from when the first
 * of those words appeared to when the last one was solved.
 */
export function maxSolvesInWindow(solves: readonly { start: number; end: number }[], windowMs = 30_000): number {
  const sorted = [...solves].sort((a, b) => a.start - b.start);
  let best = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    let count = 0;
    for (let j = i; j < sorted.length; j += 1) {
      if (sorted[j].end - sorted[i].start < windowMs) count += 1;
    }
    best = Math.max(best, count);
  }
  return best;
}
