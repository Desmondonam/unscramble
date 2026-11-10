import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Card, ProgressBar, Row, Screen } from '@/components/ui';
import { ACHIEVEMENTS } from '@/game/achievements';
import { toAchievementStats, useProgress } from '@/store/progressStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Achievements() {
  const { colors } = useTheme();
  const unlocked = useProgress((s) => s.achievements);
  const stats = useProgress((s) => s.stats);
  const s = toAchievementStats(stats);
  const count = Object.keys(unlocked).length;

  return (
    <Screen back title="Achievements">
      <Card style={{ marginBottom: spacing.lg }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <AppText variant="heading">
            {count} of {ACHIEVEMENTS.length} unlocked
          </AppText>
          <Text style={{ fontSize: 24 }}>🏅</Text>
        </Row>
        <ProgressBar ratio={count / ACHIEVEMENTS.length} color={colors.warning} />
      </Card>
      <View style={{ gap: spacing.sm }}>
        {ACHIEVEMENTS.map((a, i) => {
          const at = unlocked[a.id];
          const progress = at ? 1 : a.progress(s);
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(i * 30)}>
              <Card style={{ opacity: at ? 1 : 0.8 }}>
                <Row gap={spacing.md}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: at ? colors.successBg : colors.surfaceAlt,
                    }}
                  >
                    <Text style={{ fontSize: 26, opacity: at ? 1 : 0.4 }}>{a.icon}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <AppText variant="heading">{a.title}</AppText>
                      <AppText variant="small" color={colors.warning}>
                        +{a.coinReward} 🪙
                      </AppText>
                    </Row>
                    <AppText variant="small" muted>
                      {a.description}
                    </AppText>
                    {at ? (
                      <AppText variant="small" color={colors.success}>
                        Unlocked {new Date(at).toLocaleDateString()}
                      </AppText>
                    ) : a.unlockedByRun ? (
                      <AppText variant="small" muted>
                        Earned within a single game
                      </AppText>
                    ) : (
                      <ProgressBar ratio={progress} height={6} />
                    )}
                  </View>
                </Row>
              </Card>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}
