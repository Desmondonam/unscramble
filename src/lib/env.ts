/**
 * Public, client-safe configuration. Only EXPO_PUBLIC_* variables are
 * embedded in the bundle — never put service-role keys or payment secrets
 * here. Server secrets live in Supabase Edge Function secrets.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? '',
};

export const isBackendConfigured = (): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);
