# Backend setup (Supabase)

## 1. Create the project
1. Create a project at https://supabase.com (choose a region near your players).
2. Install the CLI locally (`npm i -D supabase` or Homebrew) and link: `npx supabase link --project-ref <ref>`.

## 2. Database
```bash
npm run db:seed-sql          # regenerate seed.sql from the bundled words
npx supabase db push         # apply supabase/migrations
npx supabase db execute --file supabase/seed.sql   # or paste seed.sql into the SQL editor
```
Re-running the seed is safe (upserts).

## 3. Edge Functions
```bash
npm run sync:shared          # copy src/game/core.ts → supabase/functions/_shared/core.ts
npx supabase functions deploy submit-game
npx supabase functions deploy daily-challenge
npx supabase functions deploy delete-account
npx supabase functions deploy billing-webhook
npx supabase secrets set ALLOWED_ORIGIN=https://play.example.com
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<long random string>   # when billing is set up
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. JWT verification is done inside each function (`verify_jwt = false` in `config.toml`), which works with both legacy and new API keys.

## 4. Authentication
- **Email**: enabled by default; keep email confirmation on. Set Site URL to your web domain and add redirect URLs: `https://play.example.com/auth/callback` and `unscramble://auth/callback`.
- **Google**: create OAuth credentials in Google Cloud (Web client), add the Supabase callback URL, then enable the provider in Supabase Auth → Providers.
- **Apple**: create a Services ID and key in Apple Developer, enable the provider. On iOS the app uses native Sign in with Apple (`signInWithIdToken`); add your bundle id to the provider's "Authorized client IDs".

## 5. App configuration
Put the project URL and anon/publishable key in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) and in EAS environment variables for builds (`eas env:create`). These are public by design; RLS protects the data.

## 6. Make yourself an admin
Sign up in the app, then in the SQL editor:
```sql
update public.profiles set role = 'admin' where username = 'your_username';
```
The Admin dashboard appears on your Profile tab. Every admin action is enforced by RLS (`is_admin()`), not by the UI.

## Security summary
- RLS on every table; clients can read public content and only their own data.
- Players can edit only their username/avatar (trigger blocks role/premium changes) and their cloud save.
- Scores/stats are written only by `apply_validated_game`, callable only by the service role from `submit-game`.
- Rate limits: 12 game submissions/min/user; 300 analytics events/min/device.
- Future daily puzzles are hidden; analytics is insert-only and readable only by admins.
- Deleting an account (`delete-account`) cascades to all personal data.
- Never ship the service-role key; it exists only as a function secret.

## Analytics queries
`admin_stats()` returns DAU/MAU, D1/D7 retention, average game length, solve rate, popular categories and flagged sessions. Raw events are in `analytics_events` (consented, anonymous install id). Consider a scheduled job to delete events older than 13 months:
```sql
delete from public.analytics_events where created_at < now() - interval '13 months';
```
