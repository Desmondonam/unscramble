import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { AppText, Button, Card, Notice, Row, Screen, Section, Stat } from '@/components/ui';
import { AdminStats, fetchAdminStats } from '@/lib/admin';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';

function Dashboard() {
  const router = useRouter();
  const categories = useContent((s) => s.categories);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAdminStats()
        .then(setStats)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load stats'));
    }, []),
  );

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const pct = (v: number) => `${Math.round((v ?? 0) * 100)}%`;

  return (
    <Screen back title="Admin">
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginBottom: spacing.xl }}>
        <Button label="Words" icon="🔤" size="sm" onPress={() => router.push('/admin/words')} />
        <Button label="Daily & featured" icon="🗓️" size="sm" onPress={() => router.push('/admin/daily')} />
        <Button label="Categories & config" icon="🗂️" size="sm" onPress={() => router.push('/admin/content')} />
        <Button label="Users" icon="👥" size="sm" onPress={() => router.push('/admin/users')} />
      </Row>

      {error && <Notice tone="danger" text={error} />}
      {!stats && !error && <ActivityIndicator />}
      {stats && (
        <>
          <Section title="Players">
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
              <Stat icon="👥" value={stats.total_users} label="Users" />
              <Stat icon="📈" value={stats.dau} label="DAU" />
              <Stat icon="📅" value={stats.mau} label="MAU" />
              <Stat icon="👑" value={stats.premium_users} label="Premium" />
            </Row>
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
              <Stat icon="↩️" value={pct(stats.d1_retention)} label="D1 retention" />
              <Stat icon="🔁" value={pct(stats.d7_retention)} label="D7 retention" />
            </Row>
          </Section>
          <Section title="Gameplay">
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
              <Stat icon="🎮" value={stats.games_today} label="Games today" />
              <Stat icon="🗓️" value={stats.games_7d} label="Games 7d" />
              <Stat icon="⏱️" value={`${Math.round(stats.avg_session_seconds)}s`} label="Avg game" />
              <Stat icon="✅" value={pct(stats.completion_rate)} label="Solve rate" />
            </Row>
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
              <Stat icon="🚩" value={stats.flagged_sessions_7d} label="Flagged 7d" />
              <Stat icon="🔤" value={`${stats.active_words}/${stats.total_words}`} label="Active words" />
            </Row>
          </Section>
          <Section title="Popular categories (7 days)">
            <Card style={{ gap: spacing.sm }}>
              {(stats.popular_categories ?? []).length === 0 && <AppText muted>No category games yet.</AppText>}
              {(stats.popular_categories ?? []).map((c) => (
                <Row key={c.category_id} style={{ justifyContent: 'space-between' }}>
                  <AppText>{catName(c.category_id)}</AppText>
                  <AppText variant="heading">{c.games}</AppText>
                </Row>
              ))}
            </Card>
          </Section>
          <Section title="Top scores (7 days)">
            <Card style={{ gap: spacing.sm }}>
              {(stats.top_scores_7d ?? []).length === 0 && <AppText muted>No games yet.</AppText>}
              {(stats.top_scores_7d ?? []).map((s, i) => (
                <View key={`${s.username}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText>
                    {i + 1}. {s.username}
                  </AppText>
                  <AppText variant="heading">{s.score}</AppText>
                </View>
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function AdminHome() {
  return (
    <AdminGate title="Admin">
      <Dashboard />
    </AdminGate>
  );
}
