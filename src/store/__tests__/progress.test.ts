import { DEFAULT_REMOTE_CONFIG, parseRemoteConfig } from '@/config/remoteConfig';
import { TILE_THEMES } from '@/theme/tokens';
import { mergeStats, useProgress } from '../progressStore';

const cfg = DEFAULT_REMOTE_CONFIG;

beforeEach(() => useProgress.getState().resetProgress());

describe('lives', () => {
  it('regenerates one life per period up to the maximum', () => {
    const p = useProgress.getState();
    const t0 = 1_000_000;
    p.loseLife(cfg, t0);
    p.loseLife(cfg, t0);
    expect(useProgress.getState().lives).toBe(3);
    useProgress.getState().regenerateLives(cfg, t0 + cfg.lifeRegenMinutes * 60_000 - 1);
    expect(useProgress.getState().lives).toBe(3);
    useProgress.getState().regenerateLives(cfg, t0 + cfg.lifeRegenMinutes * 60_000);
    expect(useProgress.getState().lives).toBe(4);
    useProgress.getState().regenerateLives(cfg, t0 + cfg.lifeRegenMinutes * 60_000 * 10);
    expect(useProgress.getState().lives).toBe(5);
  });

  it('never goes below zero', () => {
    for (let i = 0; i < 10; i += 1) useProgress.getState().loseLife(cfg);
    expect(useProgress.getState().lives).toBe(0);
  });
});

describe('daily reward', () => {
  it('can be claimed once per day and grows with the streak', () => {
    const day1 = new Date(2026, 10, 10, 9);
    const day2 = new Date(2026, 10, 11, 9);
    expect(useProgress.getState().claimDailyReward(cfg, day1)).toBe(10);
    expect(useProgress.getState().claimDailyReward(cfg, day1)).toBe(0);
    expect(useProgress.getState().canClaimDailyReward(day1)).toBe(false);
    expect(useProgress.getState().claimDailyReward(cfg, day2)).toBe(15);
    expect(useProgress.getState().stats.coins).toBe(50 + 25);
  });
});

describe('cosmetics', () => {
  it('buys coin themes only with enough coins and unlocks level themes by level', () => {
    const mint = TILE_THEMES.find((t) => t.id === 'mint')!;
    const ocean = TILE_THEMES.find((t) => t.id === 'ocean')!;
    const galaxy = TILE_THEMES.find((t) => t.id === 'galaxy')!;
    expect(useProgress.getState().unlockTheme(mint, false)).toBe(false);
    useProgress.setState((s) => ({ stats: { ...s.stats, coins: 200, xp: 400 } }));
    expect(useProgress.getState().unlockTheme(mint, false)).toBe(true);
    expect(useProgress.getState().stats.coins).toBe(50);
    expect(useProgress.getState().unlockTheme(ocean, false)).toBe(true);
    expect(useProgress.getState().unlockTheme(galaxy, false)).toBe(false);
    expect(useProgress.getState().unlockTheme(galaxy, true)).toBe(true);
  });
});

describe('cloud merge', () => {
  it('never loses progress from either device', () => {
    const local = useProgress.getState().stats;
    const merged = mergeStats(
      { ...local, xp: 100, wordsSolved: 10, categoriesSolved: ['animals'], lastDailyDate: '2026-11-10', dailyStreak: 3 },
      { xp: 500, wordsSolved: 5, categoriesSolved: ['food'], lastDailyDate: '2026-11-11', dailyStreak: 4 },
    );
    expect(merged.xp).toBe(500);
    expect(merged.wordsSolved).toBe(10);
    expect(merged.categoriesSolved.sort()).toEqual(['animals', 'food']);
    expect(merged.lastDailyDate).toBe('2026-11-11');
    expect(merged.dailyStreak).toBe(4);
  });
});

describe('remote config', () => {
  it('ignores unknown keys and values of the wrong type', () => {
    const config = parseRemoteConfig([
      { key: 'maxLives', value: 7 },
      { key: 'freeHintsPerDay', value: 'lots' },
      { key: 'premiumCategoryIds', value: ['business'] },
      { key: 'adsEnabled', value: 'yes' },
      { key: 'serviceRoleKey', value: 'nope' },
      { key: 'lifeRegenMinutes', value: -5 },
    ]);
    expect(config.maxLives).toBe(7);
    expect(config.freeHintsPerDay).toBe(DEFAULT_REMOTE_CONFIG.freeHintsPerDay);
    expect(config.premiumCategoryIds).toEqual(['business']);
    expect(config.adsEnabled).toBe(false);
    expect(config.lifeRegenMinutes).toBe(DEFAULT_REMOTE_CONFIG.lifeRegenMinutes);
    expect('serviceRoleKey' in config).toBe(false);
  });
});
