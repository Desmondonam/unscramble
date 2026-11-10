import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LivesPill } from '@/components/LivesIndicator';
import { AppText, Button, Card, Notice, Pill, ProgressBar, Row, Screen, Section, Stat } from '@/components/ui';
import { displayedDailyStreak, levelProgress, localDateKey } from '@/game/core';
import { isBackendConfigured } from '@/lib/env';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/store/authStore';
import { useContent } from '@/store/contentStore';
import { useProgress } from '@/store/progressStore';
import { avatarEmoji, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  const progress = useProgress();
  const config = useContent((s) => s.config);
  const featured = useContent((s) => s.featured);
  const user = useAuth((s) => s.user);
  const profileName = useAuth((s) => s.profile?.username);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  const today = localDateKey();
  const level = levelProgress(progress.stats.xp);
  const dailyDone = Boolean(progress.dailyHistory[today]);
  const dailyStreak = displayedDailyStreak(progress.stats.lastDailyDate, progress.stats.dailyStreak, today);
  const canClaim = progress.canClaimDailyReward();
  const name = profileName || progress.username || 'Player';

  const claim = () => {
    const amount = progress.claimDailyReward(config);
    if (amount > 0) {
      feedback.success();
      setRewardMessage(`+${amount} coins! Come back tomorrow for a bigger reward.`);
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Row gap={spacing.md} style={{ flex: 1 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>{avatarEmoji(progress.avatarId)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="small" muted>
              {greeting()}
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {name}
            </AppText>
          </View>
        </Row>
        <Row gap={6}>
          <Pill icon="🪙" text={progress.stats.coins} />
          <LivesPill />
        </Row>
      </Row>

      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.primary, borderColor: colors.primary }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="caption" color="#FFFFFFCC">
              Level {level.level}
            </AppText>
            <AppText variant="small" color="#FFFFFFCC">
              {level.current}/{level.needed} XP
            </AppText>
          </Row>
          <View style={{ marginVertical: spacing.sm }}>
            <ProgressBar ratio={level.ratio} color="#FFD43B" />
          </View>
          <AppText variant="display" color="#FFFFFF" style={{ marginTop: spacing.sm }}>
            Ready to play?
          </AppText>
          <AppText color="#FFFFFFDD" style={{ marginBottom: spacing.lg }}>
            Rebuild scrambled words, build streaks and level up.
          </AppText>
          <Button label="Play now" icon="▶" size="lg" variant="secondary" onPress={() => router.push('/play')} testID="play-now" />
        </Card>
      </Animated.View>

      <Row gap={spacing.sm} style={{ marginBottom: spacing.xl, flexWrap: 'wrap' }}>
        <Stat icon="🔥" value={progress.stats.currentStreak} label="Streak" />
        <Stat icon="🏆" value={progress.stats.bestStreak} label="Best" />
        <Stat icon="📅" value={dailyStreak} label="Daily" />
        <Stat icon="📖" value={progress.stats.wordsSolved} label="Solved" />
      </Row>

      <Section title="Today">
        <Card onPress={() => router.push('/(tabs)/daily')} style={{ marginBottom: spacing.md }} accessibilityLabel="Open the daily challenge">
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">🗓️ Daily Challenge</AppText>
              <AppText muted variant="small">
                {dailyDone ? `Done! Score ${progress.dailyHistory[today].score}. New puzzle tomorrow.` : 'Five words, same for everyone. Keep your streak alive.'}
              </AppText>
            </View>
            <AppText variant="heading" color={dailyDone ? colors.success : colors.primary}>
              {dailyDone ? '✓' : '›'}
            </AppText>
          </Row>
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="heading">🎁 Daily reward</AppText>
              <AppText muted variant="small">
                {canClaim ? `Day ${Math.min(progress.dailyRewardStreak + 1, config.dailyRewardCoins.length)} reward is ready.` : 'Claimed today. Rewards grow each day you return.'}
              </AppText>
            </View>
            <Button label={canClaim ? 'Claim' : 'Claimed'} size="sm" variant={canClaim ? 'success' : 'secondary'} disabled={!canClaim} onPress={claim} />
          </Row>
          {rewardMessage && (
            <View style={{ marginTop: spacing.md }}>
              <Notice tone="success" text={rewardMessage} />
            </View>
          )}
        </Card>
      </Section>

      {featured.length > 0 && (
        <Section title="Featured">
          {featured.map((f) => (
            <Card
              key={f.id}
              style={{ marginBottom: spacing.md }}
              onPress={() =>
                router.push({ pathname: '/play/setup', params: { mode: f.categoryId ? 'categories' : 'classic', category: f.categoryId ?? '', difficulty: f.difficulty } })
              }
              accessibilityLabel={`Featured challenge: ${f.title}`}
            >
              <AppText variant="heading">⭐ {f.title}</AppText>
              <AppText muted variant="small">
                {f.description}
              </AppText>
            </Card>
          ))}
        </Section>
      )}

      <Section title="Explore">
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          <Button label="Achievements" icon="🏅" variant="secondary" size="sm" onPress={() => router.push('/achievements')} />
          <Button label="How to play" icon="❓" variant="secondary" size="sm" onPress={() => router.push('/help')} />
          <Button label="Settings" icon="⚙️" variant="secondary" size="sm" onPress={() => router.push('/settings')} />
          {!user && isBackendConfigured() && <Button label="Sign in to sync" icon="☁️" variant="secondary" size="sm" onPress={() => router.push('/auth')} />}
        </Row>
      </Section>
    </Screen>
  );
}
