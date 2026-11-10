import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, EmptyState, MAX_CONTENT_WIDTH, Row, ScreenHeader, Segmented } from '@/components/ui';
import { isBackendConfigured } from '@/lib/env';
import { LeaderboardEntry, LeaderboardPeriod, fetchLeaderboard, fetchMyRank } from '@/lib/leaderboard';
import { flushPendingRuns } from '@/lib/sync';
import { useAuth } from '@/store/authStore';
import { avatarEmoji, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = LeaderboardPeriod | 'friends';
const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [mine, setMine] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (period: Tab) => {
      if (!isBackendConfigured() || period === 'friends') return;
      setLoading(true);
      setError(null);
      try {
        if (user) await flushPendingRuns();
        const [list, me] = await Promise.all([fetchLeaderboard(period), user ? fetchMyRank(period) : Promise.resolve(null)]);
        setEntries(list);
        setMine(me);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the leaderboard.');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void load(tab);
    }, [load, tab]),
  );

  const body = () => {
    if (!isBackendConfigured()) {
      return (
        <EmptyState
          icon="🏆"
          title="Leaderboards need an online backend"
          body="Connect Supabase (see README) to rank players worldwide. Your personal bests are on the Profile tab."
        />
      );
    }
    if (tab === 'friends') {
      return <EmptyState icon="🤝" title="Friends leaderboard — coming soon" body="Add friends and compare scores in an upcoming update." />;
    }
    if (loading && entries.length === 0) return <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />;
    if (error) return <EmptyState icon="📡" title="Couldn't load rankings" body={error} action={<Button label="Retry" onPress={() => void load(tab)} />} />;
    if (entries.length === 0) {
      return <EmptyState icon="🌱" title="No scores yet" body="Be the first on the board — finish a game while signed in." />;
    }
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {entries.map((e, i) => {
          const isMe = e.userId === user?.id;
          return (
            <Row
              key={e.userId}
              gap={spacing.md}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: isMe ? colors.surfaceAlt : 'transparent',
              }}
            >
              <AppText variant="heading" style={{ width: 36, textAlign: 'center' }}>
                {MEDALS[e.rank - 1] ?? e.rank}
              </AppText>
              <Text style={{ fontSize: 26 }}>{avatarEmoji(e.avatarId)}</Text>
              <View style={{ flex: 1 }}>
                <AppText variant="heading" numberOfLines={1}>
                  {e.username}
                  {isMe ? ' (you)' : ''}
                </AppText>
                <AppText variant="small" muted>
                  Level {e.level}
                </AppText>
              </View>
              <AppText variant="heading" color={colors.primary}>
                {e.score.toLocaleString()}
              </AppText>
            </Row>
          );
        })}
      </Card>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(tab)} />}
      >
        <ScreenHeader title="Leaderboard" />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'all', label: 'All time' },
            { value: 'friends', label: 'Friends' },
          ]}
        />
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {isBackendConfigured() && tab !== 'friends' && (
            <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
              {user ? (
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText variant="heading" color="#FFFFFF">
                    Your rank
                  </AppText>
                  <AppText variant="heading" color="#FFFFFF">
                    {mine ? `#${mine.rank} · ${mine.score.toLocaleString()} pts` : 'Play a game to get ranked'}
                  </AppText>
                </Row>
              ) : (
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText color="#FFFFFF" style={{ flex: 1 }}>
                    Sign in to appear on the leaderboard.
                  </AppText>
                  <Button label="Sign in" size="sm" variant="secondary" onPress={() => router.push('/auth')} />
                </Row>
              )}
            </Card>
          )}
          {body()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
