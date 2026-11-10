# Monetisation plan

Freemium. Everything in Free is fully playable; Premium removes friction and adds cosmetics.

| | Free | Premium |
| --- | --- | --- |
| Classic, Timed, Daily, Categories | ✔ | ✔ |
| Hints | 3 free/day, then coins | Free (per-word caps still apply) |
| Ads | Only where enabled (`adsEnabled`) | None |
| Categories | All non-premium | + premium packs (`premiumCategoryIds` / `categories.is_premium`) |
| Themes & avatars | Level/coin unlocks | + Galaxy, Midnight, exclusive avatars |
| Advanced statistics | — | ✔ |

All switches live in the `app_config` table / `categories.is_premium` and are editable from Admin → Categories & config.

## Integrating purchases (store-policy compliant)
1. Create products: monthly and yearly subscriptions in App Store Connect and Play Console.
2. Add RevenueCat: `npx expo install react-native-purchases` (requires a development build), configure with the Supabase user id as `appUserID`.
3. Implement `BillingProvider` in `src/lib/monetization.ts` (`getProducts`, `purchase`, `restore`, `manageSubscriptionsUrl`) and call `registerBillingProvider()` at start-up on iOS/Android only.
4. Point the RevenueCat webhook to `https://<project>.functions.supabase.co/billing-webhook` with `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`. The function sets `profiles.is_premium`/`premium_until`; the app reads it.
5. No external payment links or web checkout inside the iOS/Android apps.

## Rewarded ads
1. `npx expo install react-native-google-mobile-ads`, configure app ids in `app.json`.
2. Implement `RewardedAdProvider.show()`; grant the life only after server-side verification (SSV callback → Edge Function), then enable `rewardedAdsEnabled`.
3. Respect consent (UMP) and keep ads off for child-directed audiences.
