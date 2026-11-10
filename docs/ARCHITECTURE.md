# Architecture

## Overview

```
┌──────────────── Expo app (web · iOS · Android) ────────────────┐
│ Expo Router screens  →  Zustand stores  →  pure game logic     │
│   src/app               src/store          src/game/core.ts    │
│                          │   ▲                                  │
│            AsyncStorage ◄┘   │ offline-first                    │
└──────────────────────────────┼──────────────────────────────────┘
                               │ supabase-js (anon key, user JWT)
┌──────────────────────────────▼──────────────────────────────────┐
│ Supabase                                                         │
│  Postgres + RLS   ── words, categories, profiles, stats, …        │
│  Auth             ── email/password, Google, Apple               │
│  Edge Functions   ── submit-game (validation), daily-challenge,  │
│                      delete-account, billing-webhook             │
│                      (share src/game/core.ts byte-for-byte)      │
└──────────────────────────────────────────────────────────────────┘
```

## Key decisions

| Decision | Why |
| --- | --- |
| **Offline-first, backend optional** | Guests can play everything with no network. The bundled 1,145-word bank is the offline source; when Supabase is configured the app syncs words/categories/config from the database (cached), so admin edits reach players without a release. |
| **Difficulty is derived from word length** | Easy 3–4, Medium 5–6, Hard 7–9, Expert 10+ (configurable in `difficulty_levels`). The original prototype labelled words by hand and got many wrong (an 8-letter word marked Expert, a 6-letter word marked Hard). Deriving it removes that class of bug. |
| **One pure rules module (`core.ts`)** | Scrambling, validation, scoring, levels, daily selection and run validation live in one dependency-free file. The Edge Functions use an identical copy (a test enforces it), so client and server scores always agree. |
| **Server-side score validation** | Clients submit *what happened* (word ids, solved/not, seconds, hints). The server looks words up itself, recomputes difficulty and score, checks plausibility (minimum solve time, hint limits, duplicates, round time vs. duration, daily word list) and stores suspicious runs as **flagged** — excluded from stats and leaderboards. Clients cannot write scores at all (RLS + revoked function privilege). |
| **Daily puzzle is materialised** | `selectDailyWords(date)` is deterministic, and the server stores the result in `daily_challenges` on first request, so later word edits can't change a past or current day. Future days are hidden by RLS. Offline players get the same words from the same algorithm. |
| **Ambiguous answers** | 7 anagram pairs exist in the bank (e.g. LEMON/MELON, SEAL/SALE). Any word in the approved vocabulary that uses the same letters is accepted. Scrambles never spell another valid word. |
| **Zustand** | Small, testable without React (`store.getState()`), with `persist` for AsyncStorage. Stores hydrate before first render (fixes the original bug where defaults overwrote saved progress on launch). |
| **Expo Router** | File-based routes give deep links on web and native (`/daily`, `/game?mode=timed`). |
| **Tap-to-place instead of drag-and-drop** | Tap is faster, works identically with mouse/touch/screen readers, and on desktop players can type. Tapping a placed letter returns it; Shuffle rearranges the tray. Drag-and-drop was judged not "appropriate" enough to justify a gesture library. |
| **Monetisation behind adapters** | `src/lib/monetization.ts` defines billing and rewarded-ad interfaces. Until a real provider (RevenueCat, Google Mobile Ads) is registered, purchase/ad buttons are hidden rather than shown non-functional. Premium is granted only by the server (`billing-webhook`). |
| **Multiplayer (future)** | Not built. The schema keys everything by user, sessions are server-validated, and Supabase Realtime channels can host rooms; a `matches`/`match_players` table pair and a `submit-match-round` function would reuse `core.ts` validation. |

## Game rules (defaults, tunable via `difficulty_levels` / `app_config`)

- **Score per word** = (base + 3 × letters above the difficulty minimum + speed bonus up to 100% of base when solved under par time) × streak multiplier (1.0 → 2.0 over 10 consecutive answers) × hint factor (−20% per hint, minimum 40%). Base: Easy 10, Medium 20, Hard 35, Expert 50.
- **Hints**: first letter, reveal one correct letter, definition + masked example. Max per word: 3/3/2/1. Three free per day; then 5/10/8 coins. Premium: free (still per-word capped).
- **Lives** (Classic/Categories): 5; wrong answer or skip −1; +1 every 20 min; +1 for every 5-answer streak. Rewarded ads can be added through the adapter.
- **Timed**: 30/60/90 s; wrong answer costs 3/5/7/10 s by difficulty; no lives.
- **Daily**: five words (easy, medium, medium, hard, expert), three tries each, rewarded once per date, builds the daily streak.
- **Classic** climbs one difficulty every 5 solved words (toggle in Settings).

## Data model

See `supabase/migrations/20261111000000_init.sql`. Main tables: `categories`, `difficulty_levels`, `words`, `app_config`, `featured_challenges`, `profiles`, `player_stats`, `player_state` (cloud save), `game_sessions`, `daily_challenges`, `daily_results`, `analytics_events`.

## Bugs fixed from the original prototype

1. The same word was served every round (the "random" pick was seeded by the date) — now a no-repeat session picker.
2. Answer slots showed tray letters by index, not the letters in the order chosen.
3. Infinite recursion scrambling words with one repeated letter.
4. Saved progress was overwritten with defaults on launch (persist effect ran before load).
5. Timed mode reset to 60 s on every new word and never ended.
6. Mode switches used a stale closure, so Daily/Category changes picked the wrong word.
7. Daily could be replayed for points, and the daily streak incremented without checking consecutive days.
8. The "position" hint showed meaningless text; the definition (a hint) was always visible.
9. Many words had the wrong difficulty; categories mode only ever used "Animals" outside categories.
10. Light status bar on a forced dark theme; haptics could throw on web; no persistence of most stats.
