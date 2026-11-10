# Unscramble 🧩

A cross-platform word-unscrambling game for **web, iOS and Android**, built from one codebase with Expo (SDK 58), React Native, TypeScript, Expo Router, Zustand and Supabase.

Players rebuild scrambled words in four modes (Classic, Timed, Daily, Categories) with hints, lives, streaks, XP, coins, achievements, unlockable themes/avatars, leaderboards and optional accounts with cross-device sync. The full game works offline as a guest; the backend adds accounts, sync, leaderboards, server-validated scores and an admin dashboard.

## Quick start

```bash
npm install
cp .env.example .env        # optional — leave Supabase empty to play offline
npm run web                 # or: npm run ios / npm run android
```

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server (scan QR with a development build) |
| `npm run web` | Run in the browser |
| `npm test` | Unit, store, component and UI-flow tests (Jest) |
| `npm run test:db` | Database integration tests (real migration + RLS in PGlite) |
| `npm run typecheck` | TypeScript |
| `npm run verify` | All of the above — run before every commit |
| `npm run build:web` | Production web export to `dist/` |
| `npm run db:seed-sql` | Regenerate `supabase/seed.sql` from the bundled word lists |
| `npm run sync:shared` | Copy `src/game/core.ts` into the Edge Functions |

## Project layout

```
src/
  app/                 Expo Router screens (every file is a route)
    (tabs)/            Home, Daily, Leaderboard, Profile
    play/              Mode → category → difficulty selection
    admin/             Admin dashboard (RLS-protected)
    game.tsx results.tsx onboarding.tsx auth/ settings.tsx premium.tsx help.tsx legal.tsx achievements.tsx
  components/          Design-system components and the letter board
  game/                Pure game logic (no React): core rules, board, picker, achievements, 1,145 curated words
  store/               Zustand stores: game session, progress, settings, content, auth
  lib/                 Supabase client, sync, analytics, notifications, sharing, monetisation adapters
  theme/               Colour tokens (light/dark), tile themes, avatars
supabase/
  migrations/          Schema, RLS policies, SQL functions
  functions/           Edge Functions: submit-game, daily-challenge, delete-account, billing-webhook
  seed.sql             Generated seed (categories, difficulty levels, config, words)
  tests/               Database integration tests
docs/                  Architecture, backend, deployment, store checklists, privacy, troubleshooting
```

## Documentation

- [Architecture & technical decisions](docs/ARCHITECTURE.md)
- [Backend setup (Supabase)](docs/BACKEND.md)
- [Deployment: web, Android, iOS](docs/DEPLOYMENT.md)
- [Google Play & App Store checklists](docs/STORE_CHECKLISTS.md)
- [Monetisation plan](docs/MONETIZATION.md)
- [Privacy policy](docs/PRIVACY_POLICY.md) · [Terms](docs/TERMS.md)
- [Testing](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Status

Built and verified locally: typecheck, 92 Jest tests, 22 database tests, production web/iOS/Android bundles, and a browser smoke test at phone and desktop sizes. Not yet done (needs your accounts/credentials): Supabase project deployment, OAuth provider setup, store billing/ads SDKs, EAS signing and store submission. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The app has **not** been published to any store.
# unscramble
