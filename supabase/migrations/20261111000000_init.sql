-- =============================================================================
-- Unscramble — initial schema
--
-- Security model
--   * Every table has Row Level Security enabled.
--   * Players can read public content and their own data, edit only their own
--     username/avatar and cloud save, and insert anonymous analytics events.
--   * Scores, stats and leaderboards are written ONLY by the `submit-game`
--     Edge Function (service role) after server-side validation, through
--     `apply_validated_game`, which is not executable by clients.
--   * Admin capabilities are granted by `profiles.role = 'admin'` and checked
--     server-side with `public.is_admin()` in RLS policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Content: categories, difficulty levels, words, configuration
-- -----------------------------------------------------------------------------

create table public.categories (
  id          text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  name        text not null check (char_length(name) between 2 and 60),
  icon        text not null default '🔤' check (char_length(icon) <= 16),
  color       text not null default '#6C4CF1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_premium  boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.difficulty_levels (
  id                     text primary key check (id in ('easy', 'medium', 'hard', 'expert')),
  min_length             integer not null check (min_length >= 3),
  max_length             integer not null,
  base_score             integer not null check (base_score > 0),
  max_hints_per_word     integer not null check (max_hints_per_word between 0 and 3),
  timed_penalty_seconds  integer not null check (timed_penalty_seconds between 0 and 60),
  par_seconds            integer not null check (par_seconds between 1 and 600),
  coin_reward            integer not null check (coin_reward between 0 and 100),
  check (max_length >= min_length)
);

create table public.words (
  id             text primary key,
  word           text not null check (word ~ '^[A-Z]{3,20}$'),
  length         integer generated always as (char_length(word)) stored,
  language       text not null default 'en' check (language ~ '^[a-z]{2}$'),
  category_id    text not null references public.categories (id) on update cascade,
  definition     text not null check (char_length(definition) between 10 and 300),
  example        text check (example is null or char_length(example) <= 300),
  pronunciation  text check (pronunciation is null or char_length(pronunciation) <= 80),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (language, word),
  check (id = language || ':' || lower(word))
);
create index words_category_idx on public.words (category_id) where is_active;
create index words_length_idx on public.words (length) where is_active;
create trigger words_updated_at before update on public.words
  for each row execute function public.set_updated_at();

create table public.app_config (
  key         text primary key check (key ~ '^[A-Za-z][A-Za-z0-9]{1,40}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger app_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

create table public.featured_challenges (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 80),
  description  text not null default '' check (char_length(description) <= 300),
  category_id  text references public.categories (id) on delete set null,
  difficulty   text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create or replace function public.difficulty_for_length(p_length integer)
returns text
language sql
stable
set search_path = ''
as $$
  select id from public.difficulty_levels
  where p_length between min_length and max_length
  order by min_length
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Players
-- -----------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_id      text not null default 'fox' check (avatar_id ~ '^[a-z0-9_-]{1,30}$'),
  role           text not null default 'player' check (role in ('player', 'admin')),
  is_premium     boolean not null default false,
  premium_until  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Players may change their username and avatar, never their role or premium status.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.role := old.role;
    new.is_premium := old.is_premium;
    new.premium_until := old.premium_until;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

create table public.player_stats (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  xp                    bigint not null default 0 check (xp >= 0),
  games_played          integer not null default 0,
  words_solved          integer not null default 0,
  words_attempted       integer not null default 0,
  best_score            integer not null default 0,
  best_streak           integer not null default 0,
  daily_streak          integer not null default 0,
  longest_daily_streak  integer not null default 0,
  last_daily_date       date,
  daily_completions     integer not null default 0,
  updated_at            timestamptz not null default now()
);

-- Cloud save for cosmetic progress (achievements, unlocked themes, settings).
create table public.player_state (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 262144),
  updated_at  timestamptz not null default now()
);

-- Create a profile and stats row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'username';
  candidate text;
begin
  if requested ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(requested)) then
    candidate := requested;
  else
    candidate := 'player_' || substr(md5(new.id::text), 1, 8);
  end if;

  insert into public.profiles (id, username) values (new.id, candidate);
  insert into public.player_stats (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Games, daily challenges, leaderboards
-- -----------------------------------------------------------------------------

create table public.game_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  client_run_id     text not null check (char_length(client_run_id) between 1 and 64),
  mode              text not null check (mode in ('classic', 'timed', 'daily', 'categories')),
  difficulty        text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  category_id       text references public.categories (id) on delete set null,
  score             integer not null check (score >= 0),
  client_score      integer,
  words_solved      integer not null check (words_solved >= 0),
  words_attempted   integer not null check (words_attempted >= words_solved),
  best_streak       integer not null default 0,
  hints_used        integer not null default 0,
  duration_seconds  numeric(8, 2) not null check (duration_seconds >= 0),
  daily_date        date,
  rounds            jsonb not null,
  flagged           boolean not null default false,
  flag_reasons      text[] not null default '{}',
  started_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  unique (user_id, client_run_id)
);
create index game_sessions_created_idx on public.game_sessions (created_at desc) where not flagged;
create index game_sessions_user_idx on public.game_sessions (user_id, created_at desc);

create table public.daily_challenges (
  challenge_date  date primary key,
  word_ids        text[] not null check (cardinality(word_ids) = 5),
  title           text check (title is null or char_length(title) <= 80),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- One rewarded result per player per day (prevents duplicate rewards).
create table public.daily_results (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  challenge_date  date not null references public.daily_challenges (challenge_date) on delete cascade,
  session_id      uuid references public.game_sessions (id) on delete set null,
  score           integer not null check (score >= 0),
  solved          integer not null check (solved between 0 and 5),
  created_at      timestamptz not null default now(),
  primary key (user_id, challenge_date)
);

-- Level curve identical to `levelForXp` in src/game/core.ts: xp(L) = 50·(L−1)·L.
create or replace function public.level_for_xp(p_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, floor((1 + sqrt(1 + 4 * greatest(p_xp, 0) / 50.0)) / 2)::integer);
$$;

-- Called only by the submit-game Edge Function after it validated the run.
create or replace function public.apply_validated_game(p_user_id uuid, p_run jsonb, p_flag_reasons text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id  uuid;
  v_mode        text := p_run ->> 'mode';
  v_daily       date := nullif(p_run ->> 'daily_date', '')::date;
  v_score       integer := (p_run ->> 'score')::integer;
  v_solved      integer := (p_run ->> 'words_solved')::integer;
  v_flagged     boolean := coalesce(cardinality(p_flag_reasons), 0) > 0;
  v_daily_new   boolean := false;
  v_recent      integer;
  v_rows        integer;
begin
  -- Rate limit: at most 12 game submissions per minute per player.
  select count(*) into v_recent
  from public.game_sessions
  where user_id = p_user_id and created_at > now() - interval '1 minute';
  if v_recent >= 12 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.game_sessions (
    user_id, client_run_id, mode, difficulty, category_id, score, client_score,
    words_solved, words_attempted, best_streak, hints_used, duration_seconds,
    daily_date, rounds, flagged, flag_reasons, started_at
  ) values (
    p_user_id,
    p_run ->> 'client_run_id',
    v_mode,
    p_run ->> 'difficulty',
    nullif(p_run ->> 'category_id', ''),
    v_score,
    nullif(p_run ->> 'client_score', '')::integer,
    v_solved,
    (p_run ->> 'words_attempted')::integer,
    coalesce((p_run ->> 'best_streak')::integer, 0),
    coalesce((p_run ->> 'hints_used')::integer, 0),
    (p_run ->> 'duration_seconds')::numeric,
    v_daily,
    coalesce(p_run -> 'rounds', '[]'::jsonb),
    v_flagged,
    coalesce(p_flag_reasons, '{}'),
    (p_run ->> 'started_at')::timestamptz
  )
  on conflict (user_id, client_run_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if v_flagged then
    return jsonb_build_object('status', 'flagged', 'session_id', v_session_id);
  end if;

  if v_mode = 'daily' and v_daily is not null then
    insert into public.daily_results (user_id, challenge_date, session_id, score, solved)
    values (p_user_id, v_daily, v_session_id, v_score, v_solved)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_daily_new := v_rows > 0;
    if not v_daily_new then
      update public.game_sessions
      set flagged = true, flag_reasons = array['daily already completed']
      where id = v_session_id;
      return jsonb_build_object('status', 'flagged', 'session_id', v_session_id);
    end if;
  end if;

  update public.player_stats s set
    xp                   = s.xp + v_score,
    games_played         = s.games_played + 1,
    words_solved         = s.words_solved + v_solved,
    words_attempted      = s.words_attempted + (p_run ->> 'words_attempted')::integer,
    best_score           = greatest(s.best_score, v_score),
    best_streak          = greatest(s.best_streak, coalesce((p_run ->> 'best_streak')::integer, 0)),
    daily_streak         = case
                             when not v_daily_new then s.daily_streak
                             when s.last_daily_date = v_daily - 1 then s.daily_streak + 1
                             when s.last_daily_date = v_daily then s.daily_streak
                             else 1
                           end,
    longest_daily_streak = greatest(s.longest_daily_streak, case
                             when not v_daily_new then s.daily_streak
                             when s.last_daily_date = v_daily - 1 then s.daily_streak + 1
                             when s.last_daily_date = v_daily then s.daily_streak
                             else 1
                           end),
    last_daily_date      = case when v_daily_new then greatest(coalesce(s.last_daily_date, v_daily), v_daily) else s.last_daily_date end,
    daily_completions    = s.daily_completions + v_daily_new::integer,
    updated_at           = now()
  where s.user_id = p_user_id;

  return jsonb_build_object('status', 'ok', 'session_id', v_session_id, 'daily_rewarded', v_daily_new);
end;
$$;

create or replace function public.get_leaderboard(p_period text default 'weekly', p_limit integer default 50)
returns table (rank bigint, user_id uuid, username text, avatar_id text, score bigint, level integer)
language sql
stable
security definer
set search_path = ''
as $$
  with period_scores as (
    select g.user_id, sum(g.score)::bigint as score
    from public.game_sessions g
    where not g.flagged
      and p_period in ('weekly', 'monthly')
      and g.created_at >= case p_period
                            when 'weekly' then date_trunc('week', now())
                            else date_trunc('month', now())
                          end
    group by g.user_id
    union all
    select s.user_id, s.xp as score
    from public.player_stats s
    where p_period = 'all' and s.xp > 0
  )
  select
    rank() over (order by ps.score desc, p.created_at asc) as rank,
    p.id as user_id,
    p.username,
    p.avatar_id,
    ps.score,
    public.level_for_xp(coalesce(st.xp, 0)) as level
  from period_scores ps
  join public.profiles p on p.id = ps.user_id
  left join public.player_stats st on st.user_id = p.id
  order by ps.score desc, p.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_my_rank(p_period text default 'weekly')
returns table (rank bigint, user_id uuid, username text, avatar_id text, score bigint, level integer)
language sql
stable
security definer
set search_path = ''
as $$
  with period_scores as (
    select g.user_id, sum(g.score)::bigint as score
    from public.game_sessions g
    where not g.flagged
      and p_period in ('weekly', 'monthly')
      and g.created_at >= case p_period
                            when 'weekly' then date_trunc('week', now())
                            else date_trunc('month', now())
                          end
    group by g.user_id
    union all
    select s.user_id, s.xp from public.player_stats s where p_period = 'all' and s.xp > 0
  ),
  ranked as (
    select ps.user_id, ps.score, rank() over (order by ps.score desc, p.created_at asc) as rank
    from period_scores ps join public.profiles p on p.id = ps.user_id
  )
  select r.rank, p.id, p.username, p.avatar_id, r.score, public.level_for_xp(coalesce(st.xp, 0))
  from ranked r
  join public.profiles p on p.id = r.user_id
  left join public.player_stats st on st.user_id = p.id
  where r.user_id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Analytics (consent-gated on the client; anonymous; insert-only)
-- -----------------------------------------------------------------------------

create table public.analytics_events (
  id          bigint generated always as identity primary key,
  name        text not null check (name in (
                'app_opened', 'game_started', 'game_completed', 'answer_correct', 'answer_incorrect',
                'hint_used', 'daily_completed', 'level_up', 'achievement_unlocked',
                'premium_viewed', 'premium_converted')),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) < 4096),
  anon_id     text not null check (char_length(anon_id) between 8 and 64),
  session_id  text check (session_id is null or char_length(session_id) <= 64),
  user_id     uuid references auth.users (id) on delete cascade,
  platform    text check (platform in ('ios', 'android', 'web', 'windows', 'macos')),
  created_at  timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at);
create index analytics_events_name_idx on public.analytics_events (name, created_at);
create index analytics_events_anon_idx on public.analytics_events (anon_id, created_at);

-- Server timestamps only, plus a simple per-device rate limit.
create or replace function public.analytics_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (select count(*) from public.analytics_events
      where anon_id = new.anon_id and created_at > now() - interval '1 minute') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger analytics_events_guard before insert on public.analytics_events
  for each row execute function public.analytics_guard();

-- -----------------------------------------------------------------------------
-- Admin statistics
-- -----------------------------------------------------------------------------

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with activity as (
    select user_id::text as actor, created_at from public.game_sessions
    union all
    select coalesce(user_id::text, anon_id), created_at from public.analytics_events
  ),
  firsts as (
    select actor, min(created_at)::date as first_day from activity group by actor
  ),
  cohort as (
    select f.actor, f.first_day,
      exists (select 1 from activity a where a.actor = f.actor and a.created_at::date = f.first_day + 1) as d1,
      exists (select 1 from activity a where a.actor = f.actor and a.created_at::date between f.first_day + 1 and f.first_day + 7) as d7
    from firsts f
    where f.first_day between current_date - 37 and current_date - 8
  )
  select jsonb_build_object(
    'total_users',          (select count(*) from public.profiles),
    'premium_users',        (select count(*) from public.profiles where is_premium and (premium_until is null or premium_until > now())),
    'dau',                  (select count(distinct actor) from activity where created_at > now() - interval '1 day'),
    'mau',                  (select count(distinct actor) from activity where created_at > now() - interval '30 days'),
    'games_today',          (select count(*) from public.game_sessions where created_at > date_trunc('day', now())),
    'games_7d',             (select count(*) from public.game_sessions where created_at > now() - interval '7 days'),
    'avg_session_seconds',  coalesce((select avg(duration_seconds) from public.game_sessions where created_at > now() - interval '7 days'), 0),
    'completion_rate',      coalesce((select sum(words_solved)::numeric / nullif(sum(words_attempted), 0)
                                      from public.game_sessions where created_at > now() - interval '7 days'), 0),
    'flagged_sessions_7d',  (select count(*) from public.game_sessions where flagged and created_at > now() - interval '7 days'),
    'active_words',         (select count(*) from public.words where is_active),
    'total_words',          (select count(*) from public.words),
    'd1_retention',         coalesce((select avg(d1::int) from cohort), 0),
    'd7_retention',         coalesce((select avg(d7::int) from cohort), 0),
    'popular_categories',   coalesce((select jsonb_agg(x) from (
                               select category_id, count(*) as games from public.game_sessions
                               where category_id is not null and created_at > now() - interval '7 days'
                               group by category_id order by games desc limit 12) x), '[]'::jsonb),
    'top_scores_7d',        coalesce((select jsonb_agg(x) from (
                               select p.username, g.score from public.game_sessions g
                               join public.profiles p on p.id = g.user_id
                               where not g.flagged and g.created_at > now() - interval '7 days'
                               order by g.score desc limit 10) x), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.categories          enable row level security;
alter table public.difficulty_levels   enable row level security;
alter table public.words               enable row level security;
alter table public.app_config          enable row level security;
alter table public.featured_challenges enable row level security;
alter table public.profiles            enable row level security;
alter table public.player_stats        enable row level security;
alter table public.player_state        enable row level security;
alter table public.game_sessions       enable row level security;
alter table public.daily_challenges    enable row level security;
alter table public.daily_results       enable row level security;
alter table public.analytics_events    enable row level security;

-- Public content: readable by everyone, writable by admins.
create policy "categories readable" on public.categories for select using (is_active or (select public.is_admin()));
create policy "categories admin write" on public.categories for all using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "levels readable" on public.difficulty_levels for select using (true);
create policy "levels admin write" on public.difficulty_levels for all using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "words readable" on public.words for select using (is_active or (select public.is_admin()));
create policy "words admin write" on public.words for all using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "config readable" on public.app_config for select using (true);
create policy "config admin write" on public.app_config for all using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "featured readable" on public.featured_challenges for select using (is_active or (select public.is_admin()));
create policy "featured admin write" on public.featured_challenges for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- Future daily puzzles stay secret until (almost) their day.
create policy "daily readable" on public.daily_challenges for select
  using (challenge_date <= current_date + 1 or (select public.is_admin()));
create policy "daily admin write" on public.daily_challenges for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles: own row (admins: all). Updates limited by protect_profile_columns.
create policy "profiles self read" on public.profiles for select using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles self update" on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Stats, sessions and daily results: read-only for the owner; written by the Edge Function.
create policy "stats self read" on public.player_stats for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "sessions self read" on public.game_sessions for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "daily results self read" on public.daily_results for select using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Cloud save: owner only.
create policy "state self read" on public.player_state for select using (user_id = (select auth.uid()));
create policy "state self insert" on public.player_state for insert with check (user_id = (select auth.uid()));
create policy "state self update" on public.player_state for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Analytics: anyone may insert (consent is enforced client-side); only admins read.
create policy "analytics insert" on public.analytics_events for insert
  with check (user_id is null or user_id = (select auth.uid()));
create policy "analytics admin read" on public.analytics_events for select using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.difficulty_levels, public.words, public.app_config,
                public.featured_challenges, public.daily_challenges to anon, authenticated;
grant insert, update, delete on public.categories, public.difficulty_levels, public.words, public.app_config,
                public.featured_challenges, public.daily_challenges to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.player_stats, public.game_sessions, public.daily_results to authenticated;
grant select, insert, update on public.player_state to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

-- Clients must never call apply_validated_game directly.
revoke execute on function public.apply_validated_game(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.apply_validated_game(uuid, jsonb, text[]) to service_role;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.get_leaderboard(text, integer), public.get_my_rank(text), public.level_for_xp(bigint),
                          public.difficulty_for_length(integer), public.is_admin() to anon, authenticated;
