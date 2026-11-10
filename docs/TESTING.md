# Testing

```bash
npm run verify     # typecheck + Jest + database tests
```

| Suite | Location | Covers |
| --- | --- | --- |
| Engine | `src/game/__tests__` | Scrambling (never the original, never another valid word, no infinite loops), answer validation incl. anagram alternatives, scoring, difficulty boundaries, levels, daily selection & streaks, run validation (anti-cheat), board interactions, hints/reveal, no-repeat picker, achievements |
| Word bank | `src/game/__tests__/words.test.ts` | ≥1,000 words, no duplicates, A–Z only, every category × difficulty covered, definitions never contain the answer, example sentences contain it |
| Stores | `src/store/__tests__` | Classic/Timed/Daily/Category sessions, lives & regeneration, progressive difficulty, hint payment (free → coins → premium), daily reward once per day, cosmetics, cloud-merge, remote-config parsing, client score == server score |
| UI | `src/components/__tests__` | Tile/slot interaction and accessibility labels, responsive tile sizing |
| Flows | `src/__tests__/flows.test.tsx` | Real route tree: onboarding → home, a classic game, a full daily challenge + replay block, theme switch |
| Database | `supabase/tests/db.test.mjs` | Real migration + seed in PGlite with Supabase-equivalent roles/grants: RLS for anon/player/admin, privilege escalation blocked, score tampering blocked, daily reward once, streaks, leaderboards, rate limiting, account-deletion cascade, shared-core parity |

## Manual / device testing
- Web: `npm run build:web` and serve `dist/`; test Chrome, Safari, Firefox, Edge; phone and desktop widths (layout is capped at 720 px and wraps long words on narrow phones).
- Native: `eas build --profile preview` and install on a small Android phone, a large Android phone, an iPhone SE-size and a Pro Max-size device, plus an iPad.
- Auth flows (Google/Apple/email confirmation) need the backend and providers configured.
