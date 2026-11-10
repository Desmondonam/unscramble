/**
 * daily-challenge — returns (and on first request, creates) the puzzle for a
 * date so every player gets the same five words. Public: no sign-in needed.
 */
import { adminClient, error, handleOptions, json, utcToday } from '../_shared/http.ts';
import { ensureDailyChallenge, loadRules } from '../_shared/content.ts';
import { daysBetween, isValidDateKey } from '../_shared/core.ts';

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;

  let date = '';
  try {
    date = String(((await req.json()) as { date?: unknown }).date ?? '');
  } catch {
    return error('invalid payload');
  }
  if (!isValidDateKey(date)) return error('invalid date');
  // Local dates differ from UTC by at most a day; never reveal later puzzles.
  if (Math.abs(daysBetween(utcToday(), date)) > 1) return error('date out of range', 403);

  try {
    const admin = adminClient();
    const rules = await loadRules(admin);
    const daily = await ensureDailyChallenge(admin, date, rules);
    return json({ date, wordIds: daily.word_ids, title: daily.title });
  } catch (e) {
    console.error('daily-challenge failed', e);
    return error('Daily challenge unavailable.', 500);
  }
});
