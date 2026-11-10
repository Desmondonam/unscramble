/**
 * Monetisation adapters.
 *
 * Store billing and ads need native SDKs, store products and credentials, so
 * they cannot ship as working code until the store accounts exist. The app
 * talks to these interfaces only; until a real provider is registered,
 * `isAvailable()` is false and the UI hides purchase/ad buttons instead of
 * showing dead controls.
 *
 * Integration plan (see docs/MONETIZATION.md):
 *   - Billing: RevenueCat (`react-native-purchases`) wrapping Google Play
 *     Billing and Apple StoreKit. A RevenueCat webhook → Supabase Edge
 *     Function sets `profiles.is_premium` / `premium_until`. The client never
 *     grants premium to itself.
 *   - Rewarded ads: Google Mobile Ads (`react-native-google-mobile-ads`)
 *     with server-side verification before granting a life.
 */

export interface PremiumProduct {
  id: string;
  title: string;
  priceLabel: string;
  period: 'monthly' | 'yearly' | 'lifetime';
}

export interface BillingProvider {
  isAvailable(): boolean;
  getProducts(): Promise<PremiumProduct[]>;
  purchase(productId: string): Promise<'purchased' | 'cancelled'>;
  restore(): Promise<boolean>;
  manageSubscriptionsUrl(): string | null;
}

export interface RewardedAdProvider {
  isAvailable(): boolean;
  /** Resolves true when the player watched the whole ad. */
  show(placement: 'restore_life' | 'free_hint'): Promise<boolean>;
}

const unavailableBilling: BillingProvider = {
  isAvailable: () => false,
  getProducts: async () => [],
  purchase: async () => {
    throw new Error('Purchases are not available in this build.');
  },
  restore: async () => false,
  manageSubscriptionsUrl: () => null,
};

const unavailableAds: RewardedAdProvider = {
  isAvailable: () => false,
  show: async () => false,
};

let billing: BillingProvider = unavailableBilling;
let rewardedAds: RewardedAdProvider = unavailableAds;

export function registerBillingProvider(provider: BillingProvider): void {
  billing = provider;
}

export function registerRewardedAdProvider(provider: RewardedAdProvider): void {
  rewardedAds = provider;
}

export const getBilling = () => billing;
export const getRewardedAds = () => rewardedAds;

/** What Premium unlocks — rendered on the Premium screen. */
export const PREMIUM_BENEFITS = [
  { icon: '🚫', title: 'No ads', body: 'Play without interruptions.' },
  { icon: '💡', title: 'Unlimited hints', body: 'Hints never cost coins (per-word limits still apply).' },
  { icon: '🔓', title: 'Exclusive categories', body: 'Access premium word packs as they are released.' },
  { icon: '🎨', title: 'Premium themes & avatars', body: 'Galaxy and Midnight tiles, plus exclusive avatars.' },
  { icon: '📊', title: 'Advanced statistics', body: 'Accuracy, average solve time and per-category breakdowns.' },
] as const;
