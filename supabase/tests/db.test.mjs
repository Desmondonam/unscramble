/**
 * Database integration tests.
 *
 * Runs the real migration + seed inside PGlite (Postgres compiled to WASM), with
 * small stubs for Supabase's `auth` schema and API roles, then exercises RLS,
 * triggers, scoring/leaderboard functions and account deletion.
 *
 * Run: npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { levelForXp } = await import(pathToFileURL(join(root, 'src/game/core.ts')).href);

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Like Supabase: API roles get table privileges by default, so RLS is the real gate.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

let db;
const ids = {};

/** Run statements as a given API role / user, like PostgREST does. */
async function as(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function createUser(email, username) {
  const res = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    email,
    JSON.stringify(username ? { username } : {}),
  ]);
  return res.rows[0].id;
}

function run(overrides = {}) {
  return {
    client_run_id: `run-${Math.random().toString(36).slice(2)}`,
    mode: 'classic',
    difficulty: 'easy',
    category_id: null,
    score: 100,
    client_score: 100,
    words_solved: 4,
    words_attempted: 5,
    best_streak: 3,
    hints_used: 1,
    duration_seconds: 60,
    daily_date: null,
    started_at: new Date().toISOString(),
    rounds: [],
    ...overrides,
  };
}

async function apply(userId, r, flags = []) {
  const res = await db.query(`select public.apply_validated_game($1, $2::jsonb, $3::text[]) as result`, [userId, JSON.stringify(r), flags]);
  return res.rows[0].result;
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(join(root, 'supabase/migrations')).sort()) {
    await db.exec(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
  }
  await db.exec(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  ids.alice = await createUser('alice@example.com', 'alice');
  ids.bob = await createUser('bob@example.com', 'bob');
  ids.admin = await createUser('admin@example.com', 'admin_user');
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.admin]);
});

after(async () => {
  await db?.close();
});

describe('schema and seed', () => {
  it('seeds 12 categories, 4 difficulty levels and 1,000+ words', async () => {
    const c = await db.query('select count(*)::int n from public.categories');
    const l = await db.query('select count(*)::int n from public.difficulty_levels');
    const w = await db.query('select count(*)::int n from public.words where is_active');
    assert.equal(c.rows[0].n, 12);
    assert.equal(l.rows[0].n, 4);
    assert.ok(w.rows[0].n >= 1000, `expected >= 1000 words, got ${w.rows[0].n}`);
  });

  it('derives difficulty from length', async () => {
    const r = await db.query(`select public.difficulty_for_length(3) a, public.difficulty_for_length(6) b, public.difficulty_for_length(9) c, public.difficulty_for_length(12) d`);
    assert.deepEqual(r.rows[0], { a: 'easy', b: 'medium', c: 'hard', d: 'expert' });
  });

  it('rejects invalid words', async () => {
    await assert.rejects(db.query(`insert into public.words (id, word, category_id, definition) values ('en:a b', 'A B', 'animals', 'invalid word here')`));
    await assert.rejects(db.query(`insert into public.words (id, word, category_id, definition) values ('en:wrong', 'TIGER', 'animals', 'id does not match')`));
  });

  it('level_for_xp matches the app level curve', async () => {
    for (let xp = 0; xp <= 20000; xp += 37) {
      const r = await db.query('select public.level_for_xp($1) l', [xp]);
      assert.equal(r.rows[0].l, levelForXp(xp), `xp ${xp}`);
    }
    for (const xp of [100, 300, 600, 4500]) {
      const r = await db.query('select public.level_for_xp($1) l', [xp]);
      assert.equal(r.rows[0].l, levelForXp(xp), `boundary xp ${xp}`);
    }
  });
});

describe('new users', () => {
  it('creates a profile and stats row with the requested username', async () => {
    const p = await db.query('select username, role, is_premium from public.profiles where id = $1', [ids.alice]);
    assert.deepEqual(p.rows[0], { username: 'alice', role: 'player', is_premium: false });
    const s = await db.query('select xp from public.player_stats where user_id = $1', [ids.alice]);
    assert.equal(Number(s.rows[0].xp), 0);
  });

  it('falls back to a generated username when taken or invalid', async () => {
    const dup = await createUser('alice2@example.com', 'ALICE');
    const bad = await createUser('bad@example.com', 'no spaces!');
    const r = await db.query('select username from public.profiles where id in ($1, $2)', [dup, bad]);
    for (const row of r.rows) assert.match(row.username, /^player_[0-9a-f]{8}$/);
  });
});

describe('row level security', () => {
  it('lets anyone read active words but hides inactive ones', async () => {
    await db.query(`update public.words set is_active = false where id = 'en:cat'`);
    const visible = await as('anon', null, () => db.query(`select count(*)::int n from public.words where id in ('en:cat', 'en:dog')`));
    assert.equal(visible.rows[0].n, 1);
    const adminSees = await as('authenticated', ids.admin, () => db.query(`select count(*)::int n from public.words where id = 'en:cat'`));
    assert.equal(adminSees.rows[0].n, 1);
    await db.query(`update public.words set is_active = true where id = 'en:cat'`);
  });

  it('blocks players from editing content, but allows admins', async () => {
    await assert.rejects(
      as('authenticated', ids.alice, () =>
        db.query(`insert into public.words (id, word, category_id, definition) values ('en:zzzz', 'ZZZZ', 'animals', 'a sleepy sound')`),
      ),
    );
    const updated = await as('authenticated', ids.alice, () => db.query(`update public.words set definition = 'hacked definition' where id = 'en:dog' returning id`));
    assert.equal(updated.rows.length, 0);
    await as('authenticated', ids.admin, () =>
      db.query(`insert into public.words (id, word, category_id, definition) values ('en:zzzz', 'ZZZZ', 'animals', 'a sleepy sound')`),
    );
    const r = await db.query(`select count(*)::int n from public.words where id = 'en:zzzz'`);
    assert.equal(r.rows[0].n, 1);
  });

  it('lets players rename themselves but not grant themselves admin or premium', async () => {
    await as('authenticated', ids.alice, () =>
      db.query(`update public.profiles set username = 'alice_w', role = 'admin', is_premium = true where id = $1`, [ids.alice]),
    );
    const r = await db.query('select username, role, is_premium from public.profiles where id = $1', [ids.alice]);
    assert.deepEqual(r.rows[0], { username: 'alice_w', role: 'player', is_premium: false });
  });

  it('hides other players’ profiles, stats and sessions', async () => {
    const profiles = await as('authenticated', ids.alice, () => db.query('select id from public.profiles'));
    assert.deepEqual(profiles.rows.map((r) => r.id), [ids.alice]);
    const stats = await as('authenticated', ids.alice, () => db.query('select user_id from public.player_stats'));
    assert.deepEqual(stats.rows.map((r) => r.user_id), [ids.alice]);
  });

  it('prevents players from writing scores or calling the scoring function', async () => {
    const res = await as('authenticated', ids.alice, () => db.query(`update public.player_stats set xp = 999999 where user_id = $1 returning xp`, [ids.alice]));
    assert.equal(res.rows.length, 0);
    await assert.rejects(
      as('authenticated', ids.alice, () => db.query(`select public.apply_validated_game($1, '{}'::jsonb, '{}')`, [ids.alice])),
      /permission denied/,
    );
    await assert.rejects(
      as('authenticated', ids.alice, () =>
        db.query(
          `insert into public.game_sessions (user_id, client_run_id, mode, difficulty, score, words_solved, words_attempted, duration_seconds, rounds, started_at)
           values ($1, 'x', 'classic', 'easy', 99999, 1, 1, 1, '[]', now())`,
          [ids.alice],
        ),
      ),
    );
  });

  it('keeps cloud saves private to their owner', async () => {
    await as('authenticated', ids.alice, () => db.query(`insert into public.player_state (user_id, data) values ($1, '{"coins": 5}')`, [ids.alice]));
    await assert.rejects(as('authenticated', ids.bob, () => db.query(`insert into public.player_state (user_id, data) values ($1, '{}')`, [ids.alice])));
    const bobSees = await as('authenticated', ids.bob, () => db.query('select * from public.player_state'));
    assert.equal(bobSees.rows.length, 0);
  });

  it('accepts anonymous analytics but never exposes it to players', async () => {
    await as('anon', null, () => db.query(`insert into public.analytics_events (name, anon_id, platform) values ('app_opened', 'anon-123456', 'web')`));
    await assert.rejects(
      as('authenticated', ids.alice, () => db.query(`insert into public.analytics_events (name, anon_id, user_id) values ('app_opened', 'anon-123456', $1)`, [ids.bob])),
    );
    await assert.rejects(as('anon', null, () => db.query(`insert into public.analytics_events (name, anon_id) values ('not_an_event', 'anon-123456')`)));
    const read = await as('authenticated', ids.alice, () => db.query('select count(*)::int n from public.analytics_events'));
    assert.equal(read.rows[0].n, 0);
  });

  it('keeps future daily puzzles secret', async () => {
    await db.query(`insert into public.daily_challenges (challenge_date, word_ids) values (current_date + 5, array['en:cat','en:apple','en:garden','en:dolphin','en:microphone'])`);
    const anon = await as('anon', null, () => db.query('select count(*)::int n from public.daily_challenges where challenge_date = current_date + 5'));
    assert.equal(anon.rows[0].n, 0);
    const admin = await as('authenticated', ids.admin, () => db.query('select count(*)::int n from public.daily_challenges where challenge_date = current_date + 5'));
    assert.equal(admin.rows[0].n, 1);
  });

  it('restricts admin statistics to admins', async () => {
    await assert.rejects(as('authenticated', ids.alice, () => db.query('select public.admin_stats()')), /forbidden/);
    const r = await as('authenticated', ids.admin, () => db.query('select public.admin_stats() s'));
    assert.ok(r.rows[0].s.total_words >= 1000);
  });
});

describe('validated games and leaderboards', () => {
  it('records a game once and updates stats', async () => {
    const r = run({ score: 120, words_solved: 5, best_streak: 5 });
    assert.equal((await apply(ids.bob, r)).status, 'ok');
    assert.equal((await apply(ids.bob, r)).status, 'duplicate');
    const s = await db.query('select xp, games_played, words_solved, best_score, best_streak from public.player_stats where user_id = $1', [ids.bob]);
    assert.deepEqual(
      { ...s.rows[0], xp: Number(s.rows[0].xp) },
      { xp: 120, games_played: 1, words_solved: 5, best_score: 120, best_streak: 5 },
    );
  });

  it('stores flagged games without crediting them', async () => {
    const res = await apply(ids.bob, run({ score: 50000 }), ['implausibly fast']);
    assert.equal(res.status, 'flagged');
    const s = await db.query('select xp from public.player_stats where user_id = $1', [ids.bob]);
    assert.equal(Number(s.rows[0].xp), 120);
  });

  it('rewards each daily challenge once and builds the daily streak', async () => {
    const days = ['2026-11-09', '2026-11-10'];
    for (const d of days) {
      await db.query(`insert into public.daily_challenges (challenge_date, word_ids) values ($1, array['en:cat','en:apple','en:garden','en:dolphin','en:microphone']) on conflict do nothing`, [d]);
      assert.equal((await apply(ids.alice, run({ mode: 'daily', daily_date: d, score: 200, words_solved: 5 }))).status, 'ok');
    }
    const replay = await apply(ids.alice, run({ mode: 'daily', daily_date: days[1], score: 200, words_solved: 5 }));
    assert.equal(replay.status, 'flagged');
    const s = await db.query('select xp, daily_streak, longest_daily_streak, daily_completions, last_daily_date::text d from public.player_stats where user_id = $1', [ids.alice]);
    assert.deepEqual({ ...s.rows[0], xp: Number(s.rows[0].xp) }, { xp: 400, daily_streak: 2, longest_daily_streak: 2, daily_completions: 2, d: '2026-11-10' });
  });

  it('ranks players on weekly, monthly and all-time boards, ignoring flagged games', async () => {
    const weekly = await as('anon', null, () => db.query(`select rank::int, username, score::int from public.get_leaderboard('weekly', 10)`));
    assert.deepEqual(weekly.rows, [
      { rank: 1, username: 'alice_w', score: 400 },
      { rank: 2, username: 'bob', score: 120 },
    ]);
    const all = await as('anon', null, () => db.query(`select username, score::int, level from public.get_leaderboard('all', 10)`));
    assert.deepEqual(all.rows[0], { username: 'alice_w', score: 400, level: levelForXp(400) });
    const mine = await as('authenticated', ids.bob, () => db.query(`select rank::int, score::int from public.get_my_rank('weekly')`));
    assert.deepEqual(mine.rows[0], { rank: 2, score: 120 });
  });

  it('rate-limits rapid submissions', async () => {
    const carol = await createUser('carol@example.com', 'carol');
    for (let i = 0; i < 12; i += 1) await apply(carol, run());
    await assert.rejects(apply(carol, run()), /rate_limited/);
  });
});

describe('account deletion', () => {
  it('removes the profile and all associated data', async () => {
    await db.query(`insert into public.analytics_events (name, anon_id, user_id) values ('app_opened', 'anon-bob-0001', $1)`, [ids.bob]);
    await db.query('delete from auth.users where id = $1', [ids.bob]);
    for (const [table, column] of [
      ['public.profiles', 'id'],
      ['public.player_stats', 'user_id'],
      ['public.game_sessions', 'user_id'],
      ['public.analytics_events', 'user_id'],
    ]) {
      const r = await db.query(`select count(*)::int n from ${table} where ${column} = $1`, [ids.bob]);
      assert.equal(r.rows[0].n, 0, `${table} still has rows`);
    }
  });
});

describe('shared rules', () => {
  it('edge functions use an identical copy of the game core', () => {
    const app = readFileSync(join(root, 'src/game/core.ts'), 'utf8');
    const server = readFileSync(join(root, 'supabase/functions/_shared/core.ts'), 'utf8');
    assert.equal(server, app, 'Run `npm run sync:shared` to update supabase/functions/_shared/core.ts');
  });
});
