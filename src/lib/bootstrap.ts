import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/store/authStore';
import { useContent } from '@/store/contentStore';
import { useProgress } from '@/store/progressStore';
import { useSettings } from '@/store/settingsStore';
import { flush as flushAnalytics, track } from './analytics';
import { configureNotificationHandler } from './notifications';
import { syncAll } from './sync';

const persisted = [useSettings, useProgress, useContent] as const;

/** True once every persisted store has loaded from storage (prevents the old "save defaults over saved progress" bug). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => persisted.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (hydrated) return;
    const check = () => setHydrated(persisted.every((s) => s.persist.hasHydrated()));
    const unsubs = persisted.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [hydrated]);
  return hydrated;
}

let started = false;

/** One-time app start-up work, after stores are hydrated. */
export function bootstrap(): () => void {
  if (started) return () => undefined;
  started = true;
  configureNotificationHandler();
  const config = useContent.getState().config;
  useProgress.getState().regenerateLives(config);
  track('app_opened');

  void useAuth
    .getState()
    .init()
    .then(() => {
      if (useAuth.getState().session) void syncAll();
    });
  void useContent.getState().sync();

  // Sync whenever a player signs in.
  let lastUserId = useAuth.getState().user?.id ?? null;
  const unsubAuth = useAuth.subscribe((state) => {
    const id = state.user?.id ?? null;
    if (id && id !== lastUserId) void syncAll();
    lastUserId = id;
  });

  const sub = AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      useProgress.getState().regenerateLives(useContent.getState().config);
      void useContent.getState().sync();
      if (useAuth.getState().session) void syncAll();
    } else if (status === 'background') {
      void flushAnalytics();
    }
  });

  return () => {
    unsubAuth();
    sub.remove();
    started = false;
  };
}
