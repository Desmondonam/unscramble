import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Card, Row, Screen } from '@/components/ui';
import { localDateKey } from '@/game/core';
import { useProgress } from '@/store/progressStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const MODES = [
  { id: 'classic', icon: '🧩', title: 'Classic', body: 'Solve at your own pace. Difficulty rises as you go. Mistakes cost a life.', color: '#6C4CF1' },
  { id: 'timed', icon: '⏱️', title: 'Timed Challenge', body: 'Solve as many as you can before the clock runs out. Streaks multiply your score.', color: '#FF7A59' },
  { id: 'daily', icon: '🗓️', title: 'Daily Challenge', body: 'Five words, identical for every player today. One reward per day.', color: '#12B886' },
  { id: 'categories', icon: '🗂️', title: 'Categories', body: 'Pick a theme — animals, cities, science and more.', color: '#228BE6' },
] as const;

export default function ModeSelect() {
  const router = useRouter();
  const { colors } = useTheme();
  const dailyDone = useProgress((s) => Boolean(s.dailyHistory[localDateKey()]));

  const open = (id: (typeof MODES)[number]['id']) => {
    if (id === 'daily') router.push('/(tabs)/daily');
    else if (id === 'categories') router.push('/play/categories');
    else router.push({ pathname: '/play/setup', params: { mode: id } });
  };

  return (
    <Screen back title="Choose a mode">
      <View style={{ gap: spacing.md }}>
        {MODES.map((m, i) => (
          <Animated.View key={m.id} entering={FadeInDown.delay(i * 60)}>
            <Card onPress={() => open(m.id)} accessibilityLabel={`${m.title}. ${m.body}`}>
              <Row gap={spacing.lg}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: m.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{m.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">
                    {m.title}
                    {m.id === 'daily' && dailyDone ? '  ✓' : ''}
                  </AppText>
                  <AppText variant="small" muted>
                    {m.body}
                  </AppText>
                </View>
                <AppText variant="title" color={colors.textMuted}>
                  ›
                </AppText>
              </Row>
            </Card>
          </Animated.View>
        ))}

        <Card style={{ opacity: 0.7 }}>
          <Row gap={spacing.lg}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28 }}>⚔️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">Multiplayer · coming soon</AppText>
              <AppText variant="small" muted>
                Challenge friends, private rooms and tournaments are on the roadmap.
              </AppText>
            </View>
          </Row>
        </Card>
      </View>
    </Screen>
  );
}
