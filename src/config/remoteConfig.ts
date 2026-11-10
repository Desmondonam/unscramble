/**
 * Feature flags and tunables. Defaults ship with the app; when Supabase is
 * configured, rows in the `app_config` table override them at runtime so
 * premium features, hint allowances etc. can be changed without a release.
 */
export interface RemoteConfig {
  maxLives: number;
  lifeRegenMinutes: number;
  /** Every N consecutive solves restores one life ("restore lives through gameplay"). */
  lifeRestoreStreak: number;
  freeHintsPerDay: number;
  premiumUnlimitedHints: boolean;
  premiumCategoryIds: string[];
  dailyRewardCoins: number[];
  dailyChallengeCoins: number;
  adsEnabled: boolean;
  rewardedAdsEnabled: boolean;
  premiumEnabled: boolean;
  progressiveEvery: number;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  maxLives: 5,
  lifeRegenMinutes: 20,
  lifeRestoreStreak: 5,
  freeHintsPerDay: 3,
  premiumUnlimitedHints: true,
  premiumCategoryIds: [],
  dailyRewardCoins: [10, 15, 20, 25, 30, 40, 60],
  dailyChallengeCoins: 25,
  adsEnabled: false,
  rewardedAdsEnabled: false,
  premiumEnabled: true,
  progressiveEvery: 5,
};

const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number');
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((n) => typeof n === 'string');

/** Merge untrusted key/value rows over the defaults, ignoring anything with the wrong type. */
export function parseRemoteConfig(rows: { key: string; value: unknown }[]): RemoteConfig {
  const config: RemoteConfig = { ...DEFAULT_REMOTE_CONFIG };
  const target = config as unknown as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_REMOTE_CONFIG)) continue;
    const fallback = (DEFAULT_REMOTE_CONFIG as unknown as Record<string, unknown>)[key];
    if (typeof fallback === 'number' && typeof value === 'number' && Number.isFinite(value) && value >= 0) target[key] = value;
    else if (typeof fallback === 'boolean' && typeof value === 'boolean') target[key] = value;
    else if (isNumberArray(fallback) && isNumberArray(value) && value.length > 0) target[key] = value;
    else if (isStringArray(fallback) && isStringArray(value)) target[key] = value;
  }
  return config;
}
