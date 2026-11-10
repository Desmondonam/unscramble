import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { AppText, Button, Card, Chip, Notice, Row, Screen, Section, Segmented } from '@/components/ui';
import { clearQueue } from '@/lib/analytics';
import { confirm } from '@/lib/confirm';
import { cancelDailyReminder, remindersSupported, scheduleDailyReminder } from '@/lib/notifications';
import { useAuth } from '@/store/authStore';
import { useProgress } from '@/store/progressStore';
import { ThemeMode, useSettings } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const HOURS = [8, 12, 17, 19, 21];

function ToggleRow({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="small" muted>
          {body}
        </AppText>
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} />
    </Row>
  );
}

export default function Settings() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useSettings();
  const auth = useAuth();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setReminders = async (enabled: boolean, hour = settings.reminderHour) => {
    if (!enabled) {
      await cancelDailyReminder();
      settings.set({ remindersEnabled: false });
      return;
    }
    const ok = await scheduleDailyReminder(hour);
    settings.set({ remindersEnabled: ok, reminderHour: hour });
    if (!ok) setMessage({ tone: 'danger', text: 'Notifications are blocked. Enable them in your device settings.' });
  };

  const resetLocal = async () => {
    const ok = await confirm('Reset progress on this device?', 'Your XP, coins, streaks and achievements on this device will be erased. This cannot be undone.', 'Reset', true);
    if (!ok) return;
    useProgress.getState().resetProgress();
    setMessage({ tone: 'success', text: 'Local progress has been reset.' });
  };

  const deleteAccount = async () => {
    const ok = await confirm(
      'Delete your account?',
      'This permanently deletes your account, profile, scores, leaderboard entries and synced progress. This cannot be undone.',
      'Delete account',
      true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await auth.deleteAccount();
      useProgress.getState().resetProgress();
      setMessage({ tone: 'success', text: 'Your account and its data have been deleted.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not delete your account. Please contact support.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Settings">
      {message && (
        <View style={{ marginBottom: spacing.lg }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      <Section title="Appearance">
        <Segmented<ThemeMode>
          value={settings.themeMode}
          onChange={(themeMode) => settings.set({ themeMode })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Section>

      <Section title="Gameplay">
        <Card style={{ gap: spacing.lg }}>
          <ToggleRow title="Haptics" body="Vibration feedback for taps and answers." value={settings.haptics} onChange={(haptics) => settings.set({ haptics })} />
          <ToggleRow
            title="Progressive Classic"
            body="Classic mode steps up a difficulty every 5 solved words."
            value={settings.progressiveClassic}
            onChange={(progressiveClassic) => settings.set({ progressiveClassic })}
          />
        </Card>
      </Section>

      {remindersSupported && (
        <Section title="Reminders">
          <Card style={{ gap: spacing.md }}>
            <ToggleRow title="Daily reminder" body="A notification when your daily puzzle is waiting." value={settings.remindersEnabled} onChange={(v) => void setReminders(v)} />
            {settings.remindersEnabled && (
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                {HOURS.map((h) => (
                  <Chip key={h} label={`${h}:00`} selected={settings.reminderHour === h} onPress={() => void setReminders(true, h)} />
                ))}
              </Row>
            )}
          </Card>
        </Section>
      )}

      <Section title="Privacy">
        <Card style={{ gap: spacing.md }}>
          <ToggleRow
            title="Share anonymous stats"
            body="Helps us balance difficulty. No names, emails, contacts or advertising IDs are collected."
            value={settings.analyticsConsent === 'granted'}
            onChange={(v) => {
              settings.set({ analyticsConsent: v ? 'granted' : 'denied' });
              if (!v) clearQueue();
            }}
          />
          <Button label="Privacy policy & terms" variant="ghost" size="sm" onPress={() => router.push('/legal')} />
        </Card>
      </Section>

      <Section title="Data">
        <View style={{ gap: spacing.sm }}>
          <Button label="Reset progress on this device" variant="secondary" onPress={() => void resetLocal()} />
          {auth.user && <Button label="Delete my account and data" variant="danger" onPress={() => void deleteAccount()} loading={busy} />}
        </View>
      </Section>

      <AppText variant="small" muted center>
        Unscramble v{Constants.expoConfig?.version ?? '1.0.0'}
      </AppText>
      <AppText variant="small" color={colors.textMuted} center>
        Made with 🧩 for word lovers
      </AppText>
    </Screen>
  );
}
