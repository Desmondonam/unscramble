import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TIMED_DURATION } from '@/game/core';
import { persistStorage } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Consent = 'unknown' | 'granted' | 'denied';

export interface SettingsState {
  themeMode: ThemeMode;
  haptics: boolean;
  remindersEnabled: boolean;
  reminderHour: number;
  analyticsConsent: Consent;
  onboardingDone: boolean;
  timedDuration: number;
  /** Classic mode climbs a difficulty level every few solved words. */
  progressiveClassic: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const DEFAULTS = {
  themeMode: 'system' as ThemeMode,
  haptics: true,
  remindersEnabled: false,
  reminderHour: 19,
  analyticsConsent: 'unknown' as Consent,
  onboardingDone: false,
  timedDuration: DEFAULT_TIMED_DURATION,
  progressiveClassic: true,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    { name: 'unscramble-settings-v1', storage: persistStorage, version: 1 },
  ),
);
