/**
 * submit-game — server-side validation of a finished game.
 *
 * The client sends only what happened (which words, solved or not, how long,
 * which hints). The server:
 *   1. authenticates the player,
 *   2. looks up every word in the database (the client's spelling is ignored),
 *   3. re-derives difficulty from the current rules,
 *   4. checks plausibility (timings, hint limits, duplicates, daily words…),
 *   5. recomputes the score with the shared rules in core.ts,
 *   6. stores the session and updates stats atomically via apply_validated_game.
 * Suspicious runs are stored as flagged and never reach the leaderboard.
 */
import { adminClient, error, handleOptions, json, requireUser, utcToday } from '../_shared/http.ts';
import { ensureDailyChallenge, loadRules } from '../_shared/content.ts';
import {
  GAME_MODES,
  GameMode,
  HINT_TYPES,
  HintType,
  MAX_ROUNDS_PER_RUN,
  RoundRecord,
  computeRunTotals,
  daysBetween,
  difficultyForLength,
  isValidDateKey,
  validateRun,
} from '../_shared/core.ts';

interface IncomingRound {
  wordId: string;
  solved: boolean;
  seconds: number;
  hints: HintType[];
  wrongAttempts: number;
}

interface Submission {
  clientRunId: string;
  mode: GameMode;
  difficulty: string;
  categoryId: string | null;
  startedAt: string;
  durationSeconds: number;
  timedDuration: number | null;
  dailyDate: string | null;
  clientScore: number;
  rounds: IncomingRound[];
}

function parse(body: unknown): Submission | string {
  if (!body || typeof body !== 'object') return 'invalid payload';
  const b = body as Record<string, unknown>;
  if (typeof b.clientRunId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(b.clientRunId)) return 'invalid clientRunId';
  if (!GAME_MODES.includes(b.mode as GameMode)) return 'invalid mode';
  if (typeof b.difficulty !== 'string') return 'invalid difficulty';
  if (b.categoryId !== null && b.categoryId !== undefined && (typeof b.categoryId !== 'string' || b.categoryId.length > 32)) return 'invalid category';
  if (typeof b.startedAt !== 'string' || Number.isNaN(Date.parse(b.startedAt))) return 'invalid startedAt';
  if (typeof b.durationSeconds !== 'number' || !Number.isFinite(b.durationSeconds) || b.durationSeconds < 0 || b.durationSeconds > 6 * 3600) return 'invalid duration';
  if (b.timedDuration !== null && b.timedDuration !== undefined && (typeof b.timedDuration !== 'number' || b.timedDuration > 600)) return 'invalid timedDuration';
  if (b.dailyDate !== null && b.dailyDate !== undefined && (typeof b.dailyDate !== 'string' || !isValidDateKey(b.dailyDate))) return 'invalid dailyDate';
  if (!Array.isArray(b.rounds) || b.rounds.length === 0 || b.rounds.length > MAX_ROUNDS_PER_RUN) return 'invalid rounds';
  for (const r of b.rounds as Record<string, unknown>[]) {
    if (!r || typeof r.wordId !== 'string' || r.wordId.length > 64) return 'invalid round word';
    if (typeof r.solved !== 'boolean') return 'invalid round result';
    if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds)) return 'invalid round time';
    if (!Array.isArray(r.hints) || r.hints.length > 3 || r.hints.some((h) => !HINT_TYPES.includes(h as HintType))) return 'invalid round hints';
    if (typeof r.wrongAttempts !== 'number' || !Number.isInteger(r.wrongAttempts) || r.wrongAttempts < 0 || r.wrongAttempts > 1000) return 'invalid round attempts';
  }
  return {
    clientRunId: b.clientRunId,
    mode: b.mode as GameMode,
    difficulty: b.difficulty,
    categoryId: (b.categoryId as string | null) ?? null,
    startedAt: b.startedAt,
    durationSeconds: b.durationSeconds,
    timedDuration: (b.timedDuration as number | null) ?? null,
    dailyDate: (b.dailyDate as string | null) ?? null,
    clientScore: typeof b.clientScore === 'number' ? Math.round(b.clientScore) : 0,
    rounds: b.rounds as IncomingRound[],
  };
}

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('invalid payload');
  }
  const sub = parse(body);
  if (typeof sub === 'string') return error(sub);

  // Only recent games are accepted (offline play is queued for up to a week).
  const startedMs = Date.parse(sub.startedAt);
  if (startedMs > Date.now() + 5 * 60_000 || startedMs < Date.now() - 8 * 86_400_000) return error('rejected: game too old');

  try {
    const rules = await loadRules(admin);
    const ids = [...new Set(sub.rounds.map((r) => r.wordId))];
    const { data: rows, error: wordsError } = await admin.from('words').select('id, word, category_id').in('id', ids);
    if (wordsError) throw wordsError;
    const byId = new Map((rows ?? []).map((w) => [w.id as string, w as { id: string; word: string; category_id: string }]));

    const flags: string[] = [];
    const rounds: RoundRecord[] = [];
    for (const r of sub.rounds) {
      const w = byId.get(r.wordId);
      if (!w) return error('rejected: unknown word');
      const difficulty = difficultyForLength(w.word.length, rules);
      if (!difficulty) return error('rejected: invalid word');
      if (sub.mode === 'categories' && sub.categoryId && w.category_id !== sub.categoryId) flags.push('word outside category');
      rounds.push({ wordId: w.id, word: w.word, difficulty, solved: r.solved, seconds: r.seconds, hints: r.hints, wrongAttempts: r.wrongAttempts });
    }

    flags.push(...validateRun({ mode: sub.mode, durationSeconds: sub.durationSeconds, timedDuration: sub.timedDuration ?? undefined, rounds }, rules));

    if (sub.mode === 'daily') {
      if (!sub.dailyDate) return error('rejected: daily date required');
      // Players are in different time zones, so allow one day either side of UTC.
      if (Math.abs(daysBetween(utcToday(), sub.dailyDate)) > 1) return error('rejected: daily date out of range');
      const already = await admin.from('daily_results').select('user_id').eq('user_id', user.id).eq('challenge_date', sub.dailyDate).maybeSingle();
      if (already.data) return error('rejected: daily already completed', 409);
      const daily = await ensureDailyChallenge(admin, sub.dailyDate, rules);
      if (daily.word_ids.join(',') !== rounds.map((r) => r.wordId).join(',')) flags.push('daily words mismatch');
    }

    const totals = computeRunTotals(rounds, rules);
    if (sub.clientScore > totals.score) flags.push('client score higher than server score');

    const { data: result, error: applyError } = await admin.rpc('apply_validated_game', {
      p_user_id: user.id,
      p_flag_reasons: [...new Set(flags)],
      p_run: {
        client_run_id: sub.clientRunId,
        mode: sub.mode,
        difficulty: DIFFICULTY_OR_DEFAULT(sub.difficulty),
        category_id: sub.mode === 'categories' ? sub.categoryId : null,
        score: totals.score,
        client_score: sub.clientScore,
        words_solved: totals.solved,
        words_attempted: totals.attempted,
        best_streak: totals.bestStreak,
        hints_used: rounds.reduce((n, r) => n + r.hints.length, 0),
        duration_seconds: Math.round(sub.durationSeconds * 100) / 100,
        daily_date: sub.mode === 'daily' ? sub.dailyDate : null,
        started_at: new Date(startedMs).toISOString(),
        rounds: rounds.map((r) => ({ id: r.wordId, s: r.solved, t: r.seconds, h: r.hints, w: r.wrongAttempts })),
      },
    });
    if (applyError) {
      if (applyError.message?.includes('rate_limited')) return error('Too many submissions. Try again shortly.', 429);
      throw applyError;
    }
    return json({ ...(result as Record<string, unknown>), serverScore: totals.score });
  } catch (e) {
    console.error('submit-game failed', e);
    return error('Could not record the game right now.', 500);
  }
});

function DIFFICULTY_OR_DEFAULT(d: string): string {
  return ['easy', 'medium', 'hard', 'expert'].includes(d) ? d : 'easy';
}
