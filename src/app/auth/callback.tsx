import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AppText, Button, EmptyState, Screen } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

/** Landing page for OAuth, email confirmation and password-reset links. */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || error) return;
    const finish = () => router.replace('/(tabs)/profile');
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return finish();
      if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) setError(exchangeError.message);
        else finish();
      } else {
        finish();
      }
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sign-in failed.'));
  }, [params.code, error, router]);

  return (
    <Screen>
      {error ? (
        <EmptyState icon="⚠️" title="Sign-in didn't complete" body={error} action={<Button label="Try again" onPress={() => router.replace('/auth')} />} />
      ) : (
        <>
          <ActivityIndicator style={{ marginTop: spacing.xxl * 3 }} />
          <AppText center muted style={{ marginTop: spacing.md }}>
            Signing you in…
          </AppText>
        </>
      )}
    </Screen>
  );
}
