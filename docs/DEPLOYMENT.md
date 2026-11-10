# Deployment

Before any release: `npm run verify` must pass.

## Web
1. Set production env vars (`EXPO_PUBLIC_*`) in your host or a `.env` used at build time.
2. `npm run build:web` → static SPA in `dist/` (`web.output: "single"`).
3. Deploy `dist/` to any static host with HTTPS and an SPA fallback to `index.html`:
   - **EAS Hosting**: `npx eas-cli@latest deploy --prod`
   - **Netlify/Vercel/Cloudflare Pages**: build command `npm run build:web`, publish dir `dist`, rewrite `/* → /index.html`.
4. Point your domain (e.g. `play.example.com`) at the host; HTTPS certificates are automatic on these hosts.
5. Add the domain to Supabase Auth redirect URLs and `ALLOWED_ORIGIN`.
6. Test on Chrome, Safari, Firefox, Edge, and on iOS Safari / Android Chrome.

## Android (Google Play)
1. `npx eas-cli@latest login` and `npx eas-cli@latest init` (writes the EAS project id into app.json).
2. Application ID is `com.unscramble.game` in `app.json` — change it to a domain you own **before the first upload**; it can never change afterwards.
3. Add env vars: `npx eas-cli@latest env:create --environment production`.
4. Build a signed App Bundle: `npx eas-cli@latest build -p android --profile production` (EAS creates and stores the upload keystore — back it up via `eas credentials`).
5. Test the release build: `--profile preview` produces an installable APK; test on several devices/sizes.
6. Submit: `npx eas-cli@latest submit -p android --profile production` (needs a Play service-account JSON). It uploads to the internal track as a draft.

## iOS (App Store)
1. Apple Developer Program membership required. Bundle id `com.unscramble.game` — change it to yours first.
2. Enable "Sign In with Apple" capability (configured via `usesAppleSignIn`).
3. `npx eas-cli@latest build -p ios --profile production` — EAS manages certificates and provisioning profiles.
4. `npx eas-cli@latest submit -p ios` → appears in App Store Connect → TestFlight. Test with internal testers first.
5. Fill in metadata, screenshots, privacy "nutrition label" and submit for review.

## Icons & splash
Replace `assets/icon.png` (1024×1024, no transparency for iOS), `assets/android-icon-*.png` (adaptive icon layers), `assets/splash-icon.png` and `assets/favicon.png` with final artwork. The current files are Expo defaults.

## Release checklist
- [ ] Version bumped in `app.json` (`version`); build numbers auto-increment remotely.
- [ ] Production Supabase migrations applied and functions deployed (`npm run sync:shared` first).
- [ ] Privacy/terms URLs live and matching `docs/PRIVACY_POLICY.md` / `docs/TERMS.md`.
- [ ] Smoke test: onboarding, each mode, daily share, sign in/out, account deletion, leaderboard.
