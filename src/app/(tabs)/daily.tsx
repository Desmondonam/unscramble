import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AppText, Button, Card, Notice, Row, Screen, Section, Stat } from '@/components/ui';
import { DAILY_DIFFICULTY_PATTERN, addDays, displayedDailyStreak, localDateKey } from '@/game/core';
import { DIFFICULTY_INFO } from '@/game/difficultyInfo';
import { dailyShareText, shareText } from '@/lib/share';
import { useContent } from '@/store/contentStore';
import { useProgress } from '@/store/progressStore';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Daily() {
  const router = useRouter();
  const { colors } = useTheme();
  const history = useProgress((s) => s.dailyHistory);
  const stats = useProgress((s) => s.stats);
  const dailyCoins = useContent((s) => s.config.dailyChallengeCoins);
  const [message, setMessage] = useState<string | null>(null);

  const today = localDateKey();
  const todayRecord = history[today];
  const streak = displayedDailyStreak(stats.lastDailyDate, stats.dailyStreak, today);

  // Last 4 weeks, oldest first, aligned so today is the last cell.
  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)), [today]);
  const past = useMemo(
    () =>
      Object.values(history)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 10),
    [history],
  );

  const share = async () => {
    if (!todayRecord) return;
    const outcome = await shareText(dailyShareText(todayRecord, streak));
    if (outcome === 'copied') setMessage('Copied to clipboard — paste it anywhere!');
  };

  return (
    <Screen title="Daily Challenge">
      <Card style={{ marginBottom: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: 44 }}>{todayRecord ? '✅' : '🗓️'}</Text>
        <AppText variant="caption" muted>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </AppText>
        {todayRecord ? (
          <>
            <AppText variant="title">Completed · {todayRecord.score} pts</AppText>
            <Row gap={6}>
              {todayRecord.results.map((r, i) => (
                <View key={i} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: r === 'solved' ? colors.success : colors.danger }} />
              ))}
            </Row>
            <AppText muted center>
              A new puzzle unlocks at midnight.
            </AppText>
            <Button label="Share result" icon="📤" onPress={() => void share()} style={{ alignSelf: 'stretch' }} />
            {message && <Notice tone="success" text={message} />}
          </>
        ) : (
          <>
            <AppText variant="title" center>
              Today&apos;s five words
            </AppText>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {DAILY_DIFFICULTY_PATTERN.map((d, i) => (
                <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: DIFFICULTY_INFO[d].color + '22' }}>
                  <AppText variant="small" color={DIFFICULTY_INFO[d].color}>
                    {DIFFICULTY_INFO[d].label}
                  </AppText>
                </View>
              ))}
            </Row>
            <AppText muted center>
              Same puzzle for every player. Three tries per word, no lives used. Earn {dailyCoins} bonus coins once per day.
            </AppText>
            <Button
              label="Play today's puzzle"
              icon="▶"
              size="lg"
              style={{ alignSelf: 'stretch' }}
              onPress={() => router.push({ pathname: '/game', params: { mode: 'daily', difficulty: 'easy' } })}
              testID="play-daily"
            />
          </>
        )}
      </Card>

      <Row gap={spacing.sm} style={{ marginBottom: spacing.xl }}>
        <Stat icon="🔥" value={streak} label="Streak" />
        <Stat icon="🏆" value={stats.longestDailyStreak} label="Longest" />
        <Stat icon="📅" value={stats.dailyCompletions} label="Completed" />
      </Row>

      <Section title="Last 4 weeks">
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {days.map((d) => {
              const rec = history[d];
              const solved = rec ? rec.results.filter((r) => r === 'solved').length : 0;
              const bg = rec ? (solved === rec.results.length ? colors.success : solved > 0 ? colors.warning : colors.danger) : colors.surfaceAlt;
              return (
                <View
                  key={d}
                  accessible
                  accessibilityLabel={`${d}: ${rec ? `${solved} of ${rec.results.length} solved` : 'not played'}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: d === today ? 2 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <AppText variant="small" color={rec ? '#FFFFFF' : colors.textMuted}>
                    {Number(d.slice(8))}
                  </AppText>
                </View>
              );
            })}
          </View>
        </Card>
      </Section>

      <Section title="History">
        {past.length === 0 ? (
          <AppText muted>No daily challenges yet — today is a great day to start.</AppText>
        ) : (
          <Card style={{ gap: spacing.md }}>
            {past.map((rec) => (
              <Row key={rec.date} style={{ justifyContent: 'space-between' }}>
                <AppText>{rec.date}</AppText>
                <AppText>{rec.results.map((r) => (r === 'solved' ? '🟩' : '🟥')).join('')}</AppText>
                <AppText variant="heading">{rec.score}</AppText>
              </Row>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
