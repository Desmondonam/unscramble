import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, View } from 'react-native';
import { Field } from '@/components/Field';
import { AppText, Button, Card, EmptyState, Notice, Row, Screen, Segmented } from '@/components/ui';
import { isBackendConfigured } from '@/lib/env';
import { useAuth, validateEmail, validatePassword, validateUsername } from '@/store/authStore';
import { useProgress } from '@/store/progressStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Mode = 'signIn' | 'signUp' | 'reset';

export default function AuthScreen() {
  const router = useRouter();
  const { colors, dark } = useTheme();
  const auth = useAuth();
  const localName = useProgress((s) => s.username);
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(localName);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (!isBackendConfigured()) {
    return (
      <Screen back title="Account">
        <EmptyState
          icon="☁️"
          title="Accounts aren't set up in this build"
          body="Your progress is saved on this device. Add Supabase keys to .env to enable sign-in, sync and leaderboards."
          action={<Button label="Keep playing" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  if (auth.user) {
    return (
      <Screen back title="Account">
        <EmptyState
          icon="✅"
          title="You're signed in"
          body={`Signed in as ${auth.user.email ?? 'your account'}. Your progress syncs across devices.`}
          action={<Button label="Continue" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const submit = () => {
    const next: Record<string, string | null> = { email: validateEmail(email) };
    if (mode !== 'reset') next.password = mode === 'signUp' ? validatePassword(password) : password ? null : 'Enter your password.';
    if (mode === 'signUp') next.username = validateUsername(username);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    void run('email', async () => {
      if (mode === 'signIn') {
        await auth.signInWithEmail(email, password);
        router.back();
      } else if (mode === 'signUp') {
        const { needsConfirmation } = await auth.signUpWithEmail(email, password, username);
        useProgress.getState().setProfile({ username });
        if (needsConfirmation) setMessage({ tone: 'success', text: 'Check your inbox to confirm your email, then sign in.' });
        else router.back();
      } else {
        await auth.resetPassword(email);
        setMessage({ tone: 'success', text: 'If an account exists for that email, a reset link is on its way.' });
      }
    });
  };

  const social = (provider: 'google' | 'apple') =>
    run(provider, async () => {
      await auth.signInWithProvider(provider);
      if (Platform.OS !== 'web' && useAuth.getState().user) router.back();
    });

  return (
    <Screen back title={mode === 'signUp' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'}>
      <AppText muted style={{ marginBottom: spacing.lg }}>
        Sign in to sync progress across devices and appear on the leaderboards. Guest play always works.
      </AppText>

      {mode !== 'reset' && (
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrors({});
            setMessage(null);
          }}
          options={[
            { value: 'signIn', label: 'Sign in' },
            { value: 'signUp', label: 'Create account' },
          ]}
        />
      )}

      <Card style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {mode === 'signUp' && (
          <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={20} error={errors.username} />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          error={errors.email}
        />
        {mode !== 'reset' && (
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            error={errors.password}
            onSubmitEditing={submit}
          />
        )}
        {message && <Notice tone={message.tone} text={message.text} />}
        <Button
          label={mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : 'Send reset link'}
          onPress={submit}
          loading={busy === 'email'}
          disabled={!!busy}
        />
        {mode === 'signIn' && <Button label="Forgot password?" variant="ghost" size="sm" onPress={() => setMode('reset')} />}
        {mode === 'reset' && <Button label="Back to sign in" variant="ghost" size="sm" onPress={() => setMode('signIn')} />}
      </Card>

      {mode !== 'reset' && (
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <Row style={{ justifyContent: 'center' }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <AppText variant="small" muted>
              or continue with
            </AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </Row>
          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={16}
              style={{ height: 50 }}
              onPress={() => void social('apple')}
            />
          ) : (
            <Button label="Continue with Apple" variant="secondary" onPress={() => void social('apple')} loading={busy === 'apple'} disabled={!!busy} />
          )}
          <Button label="Continue with Google" icon="G" variant="secondary" onPress={() => void social('google')} loading={busy === 'google'} disabled={!!busy} />
          <Button label="Continue as guest" variant="ghost" onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}
