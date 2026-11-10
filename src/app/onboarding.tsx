import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { AppText, Button, Card, Row, Screen } from '@/components/ui';
import { isBackendConfigured } from '@/lib/env';
import { remindersSupported, scheduleDailyReminder } from '@/lib/notifications';
import { useSettings } from '@/store/settingsStore';
import { TILE_THEMES, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SLIDES = [
  {
    title: 'Unscramble the letters',
    body: 'Tap the tiles in the right order to rebuild the hidden word. Tap a placed letter to send it back.',
    demo: 'PPLEA',
  },
  {
    title: 'Four ways to play',
    body: 'Classic, a 60-second Timed Challenge, a Daily puzzle shared by every player, and 12 themed Categories.',
    demo: 'GAMES',
  },
  {
    title: 'Grow your vocabulary',
    body: 'Use hints when you are stuck, earn XP and coins, unlock themes and climb the leaderboards.',
    demo: 'LEARN',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const set = useSettings((s) => s.set);
  const [step, setStep] = useState(0);
  const [analytics, setAnalytics] = useState(false);
  const [reminders, setReminders] = useState(false);
  const isFinal = step === SLIDES.length;

  const finish = async (destination: '/(tabs)' | '/auth') => {
    set({ onboardingDone: true, analyticsConsent: analytics ? 'granted' : 'denied' });
    if (reminders) {
      const ok = await scheduleDailyReminder(useSettings.getState().reminderHour);
      set({ remindersEnabled: ok });
    }
    router.replace('/(tabs)');
    if (destination === '/auth') router.push('/auth');
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Row style={{ justifyContent: 'center', marginBottom: spacing.xl }} gap={6}>
          {[...SLIDES, null].map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === step ? colors.primary : colors.border, width: i === step ? 24 : 8 }]} />
          ))}
        </Row>

        {!isFinal ? (
          <Animated.View key={step} entering={FadeInRight} exiting={FadeOutLeft} style={styles.slide}>
            <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }} gap={8}>
              {SLIDES[step].demo.split('').map((letter, i) => {
                const t = TILE_THEMES[(i + step) % 3];
                return (
                  <View key={i} style={[styles.demoTile, { backgroundColor: t.face, borderColor: t.edge }]}>
                    <Text style={[styles.demoLetter, { color: t.text }]}>{letter}</Text>
                  </View>
                );
              })}
            </Row>
            <AppText variant="display" center style={{ marginTop: spacing.xxl }}>
              {SLIDES[step].title}
            </AppText>
            <AppText muted center style={{ marginTop: spacing.md, fontSize: 17, lineHeight: 25 }}>
              {SLIDES[step].body}
            </AppText>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInRight} style={styles.slide}>
            <AppText variant="display" center>
              Your choices
            </AppText>
            <AppText muted center style={{ marginVertical: spacing.md }}>
              You can change these any time in Settings.
            </AppText>
            <Card style={{ gap: spacing.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <AppText variant="heading">Help improve the game</AppText>
                  <AppText variant="small" muted>
                    Share anonymous gameplay stats (no names, emails or contacts).
                  </AppText>
                </View>
                <Switch accessibilityLabel="Share anonymous gameplay statistics" value={analytics} onValueChange={setAnalytics} />
              </Row>
              {remindersSupported && (
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <AppText variant="heading">Daily reminder</AppText>
                    <AppText variant="small" muted>
                      A gentle nudge at 7 pm to keep your streak.
                    </AppText>
                  </View>
                  <Switch accessibilityLabel="Daily reminder notifications" value={reminders} onValueChange={setReminders} />
                </Row>
              )}
            </Card>
          </Animated.View>
        )}

        <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
          {!isFinal ? (
            <>
              <Button label="Next" size="lg" onPress={() => setStep((s) => s + 1)} />
              <Button label="Skip" variant="ghost" onPress={() => setStep(SLIDES.length)} />
            </>
          ) : (
            <>
              <Button label="Play as guest" size="lg" icon="🎮" onPress={() => void finish('/(tabs)')} />
              {isBackendConfigured() && <Button label="Sign in or create account" variant="secondary" onPress={() => void finish('/auth')} />}
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  slide: { minHeight: 320, justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  demoTile: { width: 52, height: 58, borderRadius: 14, borderWidth: 1.5, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center' },
  demoLetter: { fontSize: 26, fontWeight: '900' },
});
