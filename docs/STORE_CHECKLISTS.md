# Store submission checklists

> Preparing for submission is not the same as being published. Nothing is live until each store's review approves it.

## Google Play
- [ ] Google Play Console developer account; app created with final package name.
- [ ] Signed AAB from `eas build -p android --profile production`.
- [ ] Store listing: name (≤30), short description (≤80), full description (≤4000), 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots (+7"/10" tablet recommended).
- [ ] Category: Games → Word. Contact email, privacy policy URL.
- [ ] **Data safety form** (matches the app): Email address & User IDs (account, optional, app functionality); Game progress/app interactions (app functionality, analytics — analytics is optional/opt-in); data encrypted in transit; users can request deletion (in-app: Settings → Data). No data shared with third parties; no location/contacts/advertising ID.
- [ ] Account deletion URL/in-app path declared (required for apps with accounts).
- [ ] Content rating questionnaire (expected: Everyone).
- [ ] Target audience & content (if under-13s are targeted, Families policy applies — keep ads off for that audience).
- [ ] Ads declaration (currently: no ads).
- [ ] Internal → closed testing (new personal accounts need 12 testers for 14 days) → production.
- [ ] In-app products/subscriptions created in Play Console when billing is integrated.

## Apple App Store
- [ ] Apple Developer Program; App ID with Sign In with Apple capability.
- [ ] App Store Connect record: name, subtitle (≤30), promotional text, description, keywords (≤100 chars), support URL, marketing URL, privacy policy URL.
- [ ] Screenshots: 6.9" and 6.5" iPhone (and 13" iPad since `supportsTablet` is true).
- [ ] **App Privacy** label: Contact Info → Email (linked, app functionality); Identifiers → User ID (linked, app functionality); Usage Data → Product Interaction (not linked, analytics, opt-in); Gameplay Content (linked, app functionality). No tracking.
- [ ] Privacy manifest is in `app.json` (`ios.privacyManifests`) — keep it in sync.
- [ ] Sign in with Apple offered alongside Google sign-in (Guideline 4.8) ✔.
- [ ] Account deletion in-app (Guideline 5.1.1(v)) ✔ Settings → Data.
- [ ] Age rating questionnaire (expected 4+).
- [ ] Export compliance: `usesNonExemptEncryption: false` ✔.
- [ ] TestFlight internal testing, then submit for review with demo account notes (guest mode needs no login).
- [ ] Subscriptions configured in App Store Connect with restore purchases (present on Premium screen) when billing is integrated.

## Suggested listing copy
**Name:** Unscramble — Word Puzzle
**Short description:** Unscramble letters, build streaks and grow your vocabulary every day.
**Description:** Rebuild scrambled words across 12 themed categories and four difficulty levels. Race the clock in the Timed Challenge, solve the Daily puzzle shared by every player, earn XP and coins, unlock tile themes and avatars, and climb the weekly leaderboard. Hints, definitions and example sentences help you learn new words as you play. Play as a guest or sign in to sync across devices.
