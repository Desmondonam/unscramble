import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { getSupabase, invokeFunction } from '@/lib/supabase';

export interface Profile {
  id: string;
  username: string;
  avatarId: string;
  role: 'player' | 'admin';
  isPremium: boolean;
  premiumUntil: string | null;
}

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  init: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: { username?: string; avatarId?: string }) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export function validateUsername(name: string): string | null {
  if (!USERNAME_PATTERN.test(name)) return 'Use 3–20 letters, numbers or underscores.';
  return null;
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? null : 'Enter a valid email address.';
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return null;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Accounts are not available in this build. You can keep playing as a guest.');
  return supabase;
}

let initialised = false;

export const useAuth = create<AuthState>()((set, get) => ({
  ready: false,
  session: null,
  user: null,
  profile: null,

  init: async () => {
    if (initialised) return;
    initialised = true;
    const supabase = getSupabase();
    if (!supabase) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, ready: true });
    if (data.session) void get().refreshProfile();
    supabase.auth.onAuthStateChange((_event, session) => {
      const changedUser = session?.user?.id !== get().user?.id;
      set({ session, user: session?.user ?? null });
      if (!session) set({ profile: null });
      else if (changedUser) void get().refreshProfile();
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password, username) => {
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username }, emailRedirectTo: Linking.createURL('auth/callback') },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  },

  signInWithProvider: async (provider) => {
    const supabase = requireClient();

    if (provider === 'apple' && Platform.OS === 'ios') {
      // Native Sign in with Apple (required by App Store guideline 4.8).
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (error) throw error;
      return;
    }

    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw error;
    if (Platform.OS === 'web') return; // The browser navigates away and back to /auth/callback.

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('Sign-in was cancelled.');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  },

  resetPassword: async (email) => {
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth/callback'),
    });
    if (error) throw error;
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  refreshProfile: async () => {
    const supabase = getSupabase();
    const user = get().user;
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_id, role, is_premium, premium_until')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) return;
    const premiumActive = Boolean(data.is_premium) && (!data.premium_until || new Date(data.premium_until) > new Date());
    set({
      profile: {
        id: data.id,
        username: data.username,
        avatarId: data.avatar_id ?? 'fox',
        role: data.role === 'admin' ? 'admin' : 'player',
        isPremium: premiumActive,
        premiumUntil: data.premium_until,
      },
    });
  },

  updateProfile: async (patch) => {
    const supabase = requireClient();
    const user = get().user;
    if (!user) throw new Error('Sign in to update your profile.');
    if (patch.username !== undefined) {
      const problem = validateUsername(patch.username);
      if (problem) throw new Error(problem);
    }
    const update: Record<string, string> = {};
    if (patch.username !== undefined) update.username = patch.username;
    if (patch.avatarId !== undefined) update.avatar_id = patch.avatarId;
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
    if (error) {
      if (error.code === '23505') throw new Error('That username is already taken.');
      throw error;
    }
    await get().refreshProfile();
  },

  deleteAccount: async () => {
    await invokeFunction('delete-account', {});
    await get().signOut();
  },
}));

export const selectIsPremium = (s: AuthState) => Boolean(s.profile?.isPremium);
export const selectIsAdmin = (s: AuthState) => s.profile?.role === 'admin';
