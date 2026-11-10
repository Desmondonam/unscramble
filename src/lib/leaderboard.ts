import { getSupabase } from './supabase';

export type LeaderboardPeriod = 'all' | 'weekly' | 'monthly';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarId: string;
  score: number;
  level: number;
}

interface Row {
  rank: number;
  user_id: string;
  username: string;
  avatar_id: string | null;
  score: number;
  level: number;
}

const toEntry = (r: Row): LeaderboardEntry => ({
  rank: Number(r.rank),
  userId: r.user_id,
  username: r.username,
  avatarId: r.avatar_id ?? 'fox',
  score: Number(r.score),
  level: Number(r.level),
});

/** Leaderboards are computed server-side from validated game sessions only. */
export async function fetchLeaderboard(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_leaderboard', { p_period: period, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toEntry);
}

export async function fetchMyRank(period: LeaderboardPeriod): Promise<LeaderboardEntry | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_rank', { p_period: period });
  if (error) throw error;
  const row = ((data ?? []) as Row[])[0];
  return row ? toEntry(row) : null;
}
