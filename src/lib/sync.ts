import { useAuth } from '@/store/authStore';
import { CloudState, RunSummary, useProgress } from '@/store/progressStore';
import { getSupabase, invokeFunction } from './supabase';

const MAX_RUN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Shape sent to the `submit-game` Edge Function. The server recomputes the score. */
export function toSubmission(run: RunSummary) {
  return {
    clientRunId: run.id,
    mode: run.mode,
    difficulty: run.difficulty,
    categoryId: run.categoryId,
    startedAt: new Date(run.startedAt).toISOString(),
    durationSeconds: run.durationSeconds,
    timedDuration: run.timedDuration ?? null,
    dailyDate: run.dailyDate ?? null,
    clientScore: run.score,
    rounds: run.rounds.map((r) => ({
      wordId: r.wordId,
      solved: r.solved,
      seconds: Math.round(r.seconds * 100) / 100,
      hints: r.hints,
      wrongAttempts: r.wrongAttempts,
    })),
  };
}

let flushing = false;

/** Submit queued games for server validation and leaderboard ranking. */
export async function flushPendingRuns(): Promise<{ submitted: number; rejected: number }> {
  const result = { submitted: 0, rejected: 0 };
  if (flushing || !getSupabase() || !useAuth.getState().session) return result;
  flushing = true;
  try {
    const { pendingRuns, dequeueRun } = useProgress.getState();
    for (const run of pendingRuns) {
      if (Date.now() - run.endedAt > MAX_RUN_AGE_MS || run.rounds.length === 0) {
        dequeueRun(run.id);
        continue;
      }
      try {
        await invokeFunction('submit-game', toSubmission(run));
        result.submitted += 1;
        dequeueRun(run.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        // Validation rejections are final; network problems are retried later.
        if (/rejected|invalid|duplicate|already/i.test(message)) {
          result.rejected += 1;
          dequeueRun(run.id);
        } else {
          break;
        }
      }
    }
  } finally {
    flushing = false;
  }
  return result;
}

function cloudSnapshot(): CloudState {
  const s = useProgress.getState();
  return {
    username: s.username,
    avatarId: s.avatarId,
    tileThemeId: s.tileThemeId,
    stats: s.stats,
    achievements: s.achievements,
    dailyHistory: s.dailyHistory,
    unlockedThemes: s.unlockedThemes,
    unlockedAvatars: s.unlockedAvatars,
    lastDailyRewardDate: s.lastDailyRewardDate,
    dailyRewardStreak: s.dailyRewardStreak,
  };
}

/** Cross-device sync of cosmetic/progress state for signed-in players. */
export async function pullCloudState(): Promise<void> {
  const supabase = getSupabase();
  const user = useAuth.getState().user;
  if (!supabase || !user) return;
  const { data, error } = await supabase.from('player_state').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data?.data) useProgress.getState().importCloudState(data.data as Partial<CloudState>);
}

export async function pushCloudState(): Promise<void> {
  const supabase = getSupabase();
  const user = useAuth.getState().user;
  if (!supabase || !user) return;
  const { error } = await supabase
    .from('player_state')
    .upsert({ user_id: user.id, data: cloudSnapshot(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Full sync used after sign-in and when the app returns to the foreground. */
export async function syncAll(): Promise<void> {
  try {
    await pullCloudState();
    await pushCloudState();
    await flushPendingRuns();
  } catch {
    // Offline — try again next time.
  }
}
