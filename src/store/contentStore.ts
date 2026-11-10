import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_DIFFICULTY_RULES,
  DIFFICULTIES,
  DifficultyRules,
  dailyScramble,
  difficultyForLength,
  normalizeWord,
  selectDailyWords,
} from '@/game/core';
import { BUNDLED_CATEGORIES, BUNDLED_WORDS, CategoryInfo, WordEntry } from '@/game/words';
import { DEFAULT_REMOTE_CONFIG, RemoteConfig, parseRemoteConfig } from '@/config/remoteConfig';
import { getSupabase, invokeFunction } from '@/lib/supabase';
import { persistStorage } from './storage';

export interface DailyPuzzle {
  date: string;
  words: WordEntry[];
  scrambles: string[];
  source: 'server' | 'local';
  title?: string | null;
}

export interface FeaturedChallenge {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  difficulty: string;
  endsAt: string | null;
}

interface ContentState {
  words: WordEntry[];
  categories: CategoryInfo[];
  rules: DifficultyRules;
  config: RemoteConfig;
  featured: FeaturedChallenge[];
  lastSyncedAt: number | null;
  syncError: string | null;
  syncing: boolean;
  dailyCache: Record<string, { ids: string[]; title?: string | null }>;
  sync: () => Promise<void>;
  getDaily: (date: string) => Promise<DailyPuzzle>;
}

interface WordRow {
  id: string;
  word: string;
  category_id: string;
  definition: string;
  example: string | null;
  pronunciation: string | null;
  language: string;
  is_active: boolean;
}

export function rowToWord(row: WordRow, rules: DifficultyRules = DEFAULT_DIFFICULTY_RULES): WordEntry | null {
  const word = normalizeWord(row.word);
  const difficulty = difficultyForLength(word.length, rules);
  if (!difficulty || word.length < 3) return null;
  return {
    id: row.id,
    word,
    length: word.length,
    categoryId: row.category_id,
    difficulty,
    definition: row.definition,
    example: row.example ?? '',
    pronunciation: row.pronunciation,
    language: row.language,
    isActive: row.is_active,
  };
}

async function fetchAllWords(): Promise<WordRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const pageSize = 1000; // PostgREST caps responses at 1000 rows by default.
  const rows: WordRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('words')
      .select('id, word, category_id, definition, example, pronunciation, language, is_active')
      .eq('is_active', true)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as WordRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export const useContent = create<ContentState>()(
  persist(
    (set, get) => ({
      words: BUNDLED_WORDS,
      categories: BUNDLED_CATEGORIES,
      rules: DEFAULT_DIFFICULTY_RULES,
      config: DEFAULT_REMOTE_CONFIG,
      featured: [],
      lastSyncedAt: null,
      syncError: null,
      syncing: false,
      dailyCache: {},

      sync: async () => {
        const supabase = getSupabase();
        if (!supabase || get().syncing) return;
        set({ syncing: true, syncError: null });
        try {
          const [configRes, categoriesRes, levelsRes, featuredRes] = await Promise.all([
            supabase.from('app_config').select('key, value'),
            supabase.from('categories').select('id, name, icon, color, is_premium, sort_order').eq('is_active', true).order('sort_order'),
            supabase.from('difficulty_levels').select('*'),
            supabase
              .from('featured_challenges')
              .select('id, title, description, category_id, difficulty, ends_at')
              .eq('is_active', true)
              .lte('starts_at', new Date().toISOString())
              .order('starts_at', { ascending: false })
              .limit(3),
          ]);
          for (const res of [configRes, categoriesRes, levelsRes, featuredRes]) if (res.error) throw res.error;

          const rules: DifficultyRules = { ...DEFAULT_DIFFICULTY_RULES };
          for (const row of (levelsRes.data ?? []) as Record<string, number | string>[]) {
            const id = row.id as keyof DifficultyRules;
            if (!DIFFICULTIES.includes(id)) continue;
            rules[id] = {
              minLength: Number(row.min_length),
              maxLength: Number(row.max_length),
              baseScore: Number(row.base_score),
              maxHintsPerWord: Number(row.max_hints_per_word),
              timedPenaltySeconds: Number(row.timed_penalty_seconds),
              parSeconds: Number(row.par_seconds),
              coinReward: Number(row.coin_reward),
            };
          }

          const wordRows = await fetchAllWords();
          const words = wordRows.map((r) => rowToWord(r, rules)).filter((w): w is WordEntry => w !== null);
          const categories: CategoryInfo[] = ((categoriesRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
            id: String(c.id),
            name: String(c.name),
            icon: String(c.icon ?? '🔤'),
            color: String(c.color ?? '#6C4CF1'),
            isPremium: Boolean(c.is_premium),
            sortOrder: Number(c.sort_order ?? 0),
          }));
          const now = Date.now();
          const featured: FeaturedChallenge[] = ((featuredRes.data ?? []) as Record<string, unknown>[])
            .filter((f) => !f.ends_at || new Date(String(f.ends_at)).getTime() > now)
            .map((f) => ({
              id: String(f.id),
              title: String(f.title),
              description: String(f.description ?? ''),
              categoryId: (f.category_id as string | null) ?? null,
              difficulty: String(f.difficulty ?? 'medium'),
              endsAt: (f.ends_at as string | null) ?? null,
            }));

          set({
            // Never replace the bundled list with an empty/broken response.
            words: words.length >= 50 ? words : get().words,
            categories: categories.length > 0 ? categories : get().categories,
            rules,
            config: parseRemoteConfig((configRes.data ?? []) as { key: string; value: unknown }[]),
            featured,
            lastSyncedAt: Date.now(),
          });
        } catch (error) {
          set({ syncError: error instanceof Error ? error.message : 'Sync failed' });
        } finally {
          set({ syncing: false });
        }
      },

      getDaily: async (date) => {
        const { words, dailyCache } = get();
        const vocabulary = new Set(words.map((w) => w.word));
        const forbid = (c: string) => vocabulary.has(c);
        const build = (list: WordEntry[], source: DailyPuzzle['source'], title?: string | null): DailyPuzzle => ({
          date,
          words: list,
          scrambles: list.map((w) => dailyScramble(date, w.word, forbid)),
          source,
          title,
        });

        const byId = new Map(words.map((w) => [w.id, w]));
        const fromIds = (ids: string[]) => ids.map((id) => byId.get(id)).filter((w): w is WordEntry => !!w);

        const cached = dailyCache[date];
        if (cached) {
          const list = fromIds(cached.ids);
          if (list.length === cached.ids.length) return build(list, 'server', cached.title);
        }

        if (getSupabase()) {
          try {
            const res = await invokeFunction<{ date: string; wordIds: string[]; title?: string | null }>('daily-challenge', { date });
            const list = fromIds(res.wordIds);
            if (list.length === res.wordIds.length && list.length > 0) {
              set({ dailyCache: { ...pruneCache(get().dailyCache), [date]: { ids: res.wordIds, title: res.title } } });
              return build(list, 'server', res.title);
            }
          } catch {
            // Offline or function unavailable: fall back to the deterministic local puzzle.
          }
        }
        return build(selectDailyWords(date, words.filter((w) => w.isActive)), 'local');
      },
    }),
    {
      name: 'unscramble-content-v1',
      storage: persistStorage,
      version: 1,
      partialize: (s) =>
        ({
          // Only cache server content; bundled words ship with the app anyway.
          words: s.lastSyncedAt ? s.words : undefined,
          categories: s.categories,
          rules: s.rules,
          config: s.config,
          featured: s.featured,
          lastSyncedAt: s.lastSyncedAt,
          dailyCache: s.dailyCache,
        }) as unknown as ContentState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ContentState>;
        return {
          ...current,
          ...p,
          words: p.words && p.words.length > 0 ? p.words : current.words,
          config: { ...DEFAULT_REMOTE_CONFIG, ...(p.config ?? {}) },
        };
      },
    },
  ),
);

function pruneCache(cache: ContentState['dailyCache']): ContentState['dailyCache'] {
  const keys = Object.keys(cache).sort().slice(-14);
  return Object.fromEntries(keys.map((k) => [k, cache[k]]));
}

/** Vocabulary of approved words, used to accept alternative anagrams. */
let vocabCache: { source: WordEntry[]; set: Set<string> } | null = null;
export function getVocabulary(words: WordEntry[]): Set<string> {
  if (vocabCache?.source !== words) vocabCache = { source: words, set: new Set(words.map((w) => w.word)) };
  return vocabCache.set;
}
