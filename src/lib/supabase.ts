import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { env, isBackendConfigured } from './env';

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase client, or null when the backend is not configured.
 * The app is fully playable offline (guest mode) without a backend.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/** Call an Edge Function with the current user's JWT. */
export async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Online features are not configured.');
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) {
    // Surface the server's error message when available.
    const context = (error as { context?: Response }).context;
    let serverMessage: string | undefined;
    if (context && typeof context.json === 'function') {
      try {
        serverMessage = ((await context.json()) as { error?: string })?.error;
      } catch {
        serverMessage = undefined;
      }
    }
    throw serverMessage ? new Error(serverMessage) : error;
  }
  return data as T;
}
