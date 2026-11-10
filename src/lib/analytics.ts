import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useSettings } from '@/store/settingsStore';
import { getSupabase } from './supabase';

/**
 * Privacy-conscious analytics.
 *
 * - Nothing is recorded unless the player opted in (onboarding or Settings).
 * - Events carry a random install id, never an email, name or device id.
 * - Properties are restricted to small primitive values.
 * - Events are batched and written to `analytics_events` (insert-only RLS).
 */
export type AnalyticsEvent =
  | 'app_opened'
  | 'game_started'
  | 'game_completed'
  | 'answer_correct'
  | 'answer_incorrect'
  | 'hint_used'
  | 'daily_completed'
  | 'level_up'
  | 'achievement_unlocked'
  | 'premium_viewed'
  | 'premium_converted';

type Props = Record<string, string | number | boolean | null>;

interface QueuedEvent {
  name: AnalyticsEvent;
  props: Props;
  created_at: string;
}

const ANON_KEY = 'unscramble-anon-id';
const MAX_QUEUE = 200;
let queue: QueuedEvent[] = [];
let anonId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const sessionId = randomId();

function randomId(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    anonId = await AsyncStorage.getItem(ANON_KEY);
    if (!anonId) {
      anonId = randomId();
      await AsyncStorage.setItem(ANON_KEY, anonId);
    }
  } catch {
    anonId = randomId();
  }
  return anonId;
}

export function hasConsent(): boolean {
  return useSettings.getState().analyticsConsent === 'granted';
}

function sanitize(props: Props): Props {
  const clean: Props = {};
  for (const [key, value] of Object.entries(props).slice(0, 20)) {
    if (typeof value === 'string') clean[key.slice(0, 40)] = value.slice(0, 80);
    else clean[key.slice(0, 40)] = value;
  }
  return clean;
}

export function track(name: AnalyticsEvent, props: Props = {}): void {
  if (!hasConsent()) return;
  queue.push({ name, props: sanitize(props), created_at: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 10_000);
}

export async function flush(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const supabase = getSupabase();
  if (!supabase || queue.length === 0 || !hasConsent()) return;
  const batch = queue.splice(0, 50);
  const id = await getAnonId();
  const { data } = await supabase.auth.getSession();
  const rows = batch.map((e) => ({
    name: e.name,
    props: e.props,
    anon_id: id,
    session_id: sessionId,
    user_id: data.session?.user.id ?? null,
    platform: Platform.OS,
  }));
  const { error } = await supabase.from('analytics_events').insert(rows);
  if (error) queue.unshift(...batch); // retry later
}

/** Called when consent is withdrawn: drop anything not yet sent. */
export function clearQueue(): void {
  queue = [];
}

export const __testing = { getQueue: () => queue };
