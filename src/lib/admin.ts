import { normalizeWord } from '@/game/core';
import { getSupabase } from './supabase';

function db() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Backend not configured.');
  return supabase;
}

export interface AdminStats {
  total_users: number;
  dau: number;
  mau: number;
  games_today: number;
  games_7d: number;
  avg_session_seconds: number;
  completion_rate: number;
  flagged_sessions_7d: number;
  active_words: number;
  total_words: number;
  premium_users: number;
  d1_retention: number;
  d7_retention: number;
  popular_categories: { category_id: string; games: number }[];
  top_scores_7d: { username: string; score: number }[];
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await db().rpc('admin_stats');
  if (error) throw error;
  return data as AdminStats;
}

export interface AdminWord {
  id: string;
  word: string;
  category_id: string;
  definition: string;
  example: string | null;
  pronunciation: string | null;
  language: string;
  is_active: boolean;
}

export async function searchWords(opts: { query?: string; categoryId?: string; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 40;
  const from = (opts.page ?? 0) * pageSize;
  let q = db()
    .from('words')
    .select('id, word, category_id, definition, example, pronunciation, language, is_active', { count: 'exact' })
    .order('word')
    .range(from, from + pageSize - 1);
  if (opts.query) q = q.ilike('word', `%${normalizeWord(opts.query)}%`);
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as AdminWord[], total: count ?? 0 };
}

export function validateWordInput(input: { word: string; definition: string; example: string; category_id: string }): string | null {
  const word = normalizeWord(input.word);
  if (word.length < 3 || word.length > 20) return 'Words must be 3–20 letters (A–Z only).';
  if (word !== input.word.trim().toUpperCase()) return 'Use letters A–Z only — no spaces, digits or punctuation.';
  if (!input.category_id) return 'Choose a category.';
  if (input.definition.trim().length < 10) return 'Write a definition of at least 10 characters.';
  if (new RegExp(`\\b${word}\\b`, 'i').test(input.definition)) return 'The definition must not contain the word itself.';
  if (input.example.trim() && !new RegExp(`\\b${word}\\b`, 'i').test(input.example)) return 'The example sentence should include the word.';
  return null;
}

export async function saveWord(input: Omit<AdminWord, 'id' | 'language'> & { id?: string; language?: string }) {
  const word = normalizeWord(input.word);
  const language = input.language ?? 'en';
  const row = {
    id: input.id ?? `${language}:${word.toLowerCase()}`,
    word,
    category_id: input.category_id,
    definition: input.definition.trim(),
    example: input.example?.trim() || null,
    pronunciation: input.pronunciation?.trim() || null,
    language,
    is_active: input.is_active,
  };
  const { error } = await db().from('words').upsert(row);
  if (error) {
    if (error.code === '23505') throw new Error('That word already exists.');
    throw error;
  }
  return row.id;
}

export async function setWordActive(id: string, isActive: boolean) {
  const { error } = await db().from('words').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function deleteWord(id: string) {
  const { error } = await db().from('words').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTable<T>(table: string, order: string, ascending = true): Promise<T[]> {
  const { data, error } = await db().from(table).select('*').order(order, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function upsertRow(table: string, row: Record<string, unknown>) {
  const { error } = await db().from(table).upsert(row);
  if (error) throw error;
}

export async function deleteRow(table: string, column: string, value: string) {
  const { error } = await db().from(table).delete().eq(column, value);
  if (error) throw error;
}

export async function fetchDailyChallenges(fromDate: string, toDate: string) {
  const { data, error } = await db()
    .from('daily_challenges')
    .select('challenge_date, word_ids, title, created_by')
    .gte('challenge_date', fromDate)
    .lte('challenge_date', toDate)
    .order('challenge_date');
  if (error) throw error;
  return (data ?? []) as { challenge_date: string; word_ids: string[]; title: string | null; created_by: string | null }[];
}

export async function setDailyChallenge(date: string, words: string[], title: string | null) {
  const ids = words.map((w) => `en:${normalizeWord(w).toLowerCase()}`);
  const { data, error } = await db().from('words').select('id').in('id', ids).eq('is_active', true);
  if (error) throw error;
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Unknown or inactive words: ${missing.map((m) => m.slice(3).toUpperCase()).join(', ')}`);
  const { error: upsertError } = await db().from('daily_challenges').upsert({ challenge_date: date, word_ids: ids, title });
  if (upsertError) throw upsertError;
}

export async function fetchUsers(query: string, page = 0) {
  const pageSize = 40;
  let q = db()
    .from('profiles')
    .select('id, username, role, is_premium, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (query) q = q.ilike('username', `%${query}%`);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as { id: string; username: string; role: string; is_premium: boolean; created_at: string }[], total: count ?? 0 };
}
