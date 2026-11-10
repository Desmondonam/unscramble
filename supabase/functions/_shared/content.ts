import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  DEFAULT_DIFFICULTY_RULES,
  DIFFICULTIES,
  DailyCandidate,
  DifficultyRules,
  difficultyForLength,
  selectDailyWords,
} from './core.ts';

export async function loadRules(admin: SupabaseClient): Promise<DifficultyRules> {
  const rules: DifficultyRules = { ...DEFAULT_DIFFICULTY_RULES };
  const { data, error } = await admin.from('difficulty_levels').select('*');
  if (error) throw error;
  for (const row of data ?? []) {
    if (!DIFFICULTIES.includes(row.id)) continue;
    rules[row.id as keyof DifficultyRules] = {
      minLength: row.min_length,
      maxLength: row.max_length,
      baseScore: row.base_score,
      maxHintsPerWord: row.max_hints_per_word,
      timedPenaltySeconds: row.timed_penalty_seconds,
      parSeconds: row.par_seconds,
      coinReward: row.coin_reward,
    };
  }
  return rules;
}

/** All active words (paged — PostgREST returns at most 1000 rows per request). */
async function loadActiveWords(admin: SupabaseClient, rules: DifficultyRules): Promise<DailyCandidate[]> {
  const words: DailyCandidate[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('words').select('id, word').eq('is_active', true).order('id').range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const difficulty = difficultyForLength(row.word.length, rules);
      if (difficulty) words.push({ id: row.id, word: row.word, difficulty });
    }
    if (!data || data.length < 1000) break;
  }
  return words;
}

/**
 * Return the daily challenge for a date, creating it on first request with the
 * same deterministic algorithm the app uses offline. Once stored it never
 * changes, even if words are edited later.
 */
export async function ensureDailyChallenge(
  admin: SupabaseClient,
  date: string,
  rules: DifficultyRules,
): Promise<{ word_ids: string[]; title: string | null }> {
  const existing = await admin.from('daily_challenges').select('word_ids, title').eq('challenge_date', date).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const words = await loadActiveWords(admin, rules);
  const chosen = selectDailyWords(date, words);
  if (chosen.length !== 5) throw new Error('Not enough words to build a daily challenge.');
  const insert = await admin
    .from('daily_challenges')
    .insert({ challenge_date: date, word_ids: chosen.map((w) => w.id) })
    .select('word_ids, title')
    .maybeSingle();
  if (insert.data) return insert.data;
  // Another request created it concurrently — read the winner.
  const again = await admin.from('daily_challenges').select('word_ids, title').eq('challenge_date', date).single();
  if (again.error) throw again.error;
  return again.data;
}
