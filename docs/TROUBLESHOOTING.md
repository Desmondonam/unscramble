# Troubleshooting

| Problem | Fix |
| --- | --- |
| Leaderboard says "needs an online backend" / no Sign in button | `.env` lacks `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`. Restart with `npx expo start --clear` after editing `.env`. |
| A native module is missing in Expo Go (Apple sign-in, notifications) | Use a development build: `eas build --profile development` or `npx expo run:ios|android`. |
| OAuth returns to a blank page / "Sign-in didn't complete" | Add `unscramble://auth/callback` and `https://<domain>/auth/callback` to Supabase Auth redirect URLs; check the provider's client id/secret. |
| `submit-game` returns 401 | The user session expired — sign out/in. Ensure the function was deployed and `verify_jwt = false` is in `config.toml`. |
| Games don't appear on the leaderboard | Only signed-in, validated games count. Flagged sessions (see `game_sessions.flag_reasons`) are excluded. Queued offline games are submitted when the Leaderboard opens or the app returns to the foreground. |
| `edge functions use an identical copy of the game core` test fails | Run `npm run sync:shared` and redeploy functions. |
| Daily puzzle differs between two devices | One device is offline and the admin changed words since. Online devices always use the stored `daily_challenges` row. |
| Words edited in Admin don't show up | The app syncs content on launch and when returning to the foreground; force-close and reopen. Inactive words are hidden. |
| Notifications never arrive | Permission denied at OS level — enable in system settings; reminders are not available on web. |
| `expo-doctor` reports version mismatches | `npx expo install --fix`. |
| Metro cache issues after changing env/config | `npx expo start --clear`. |
| Web deep link 404 (e.g. `/daily`) on your host | Configure the SPA fallback rewrite to `/index.html`. |
