import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Button, Card, EmptyState, Notice, Row, Screen, Section, Stat } from '@/components/ui';
import { displayedDailyStreak, localDateKey } from '@/game/core';
import { DIFFICULTY_INFO, MODE_LABEL } from '@/game/difficultyInfo';
import { useContent } from '@/store/contentStore';
import { useGame } from '@/store/gameStore';
import { useProgress } from '@/store/progressStore';
import { dailyShareText, runShareText, shareText } from '@/lib/share';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Results() {
  const router = useRouter();
  const { colors } = useTheme();
  const gameResult = useGame((s) => s.result);
  const lastRun = useProgress((s) => s.lastRun);
  const dailyHistory = useProgress((s) => s.dailyHistory);
  const stats = useProgress((s) => s.stats);
  const words = useContent((s) => s.words);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const run = gameResult?.run ?? lastRun;
  const reward = gameResult?.reward ?? null;

  if (!run) {
    return (
      <Screen back>
        <EmptyState icon="🧩" title="No recent game" body="Play a round to see your results here." action={<Button label="Play" onPress={() => router.replace('/play')} />} />
      </Screen>
    );
  }

  const accuracy = run.attempted ? Math.round((run.solved / run.attempted) * 100) : 0;
  const solvedRounds = run.rounds.filter((r) => r.solved);
  const avgSeconds = solvedRounds.length ? solvedRounds.reduce((s, r) => s + r.seconds, 0) / solvedRounds.length : 0;
  const headline =
    run.endReason === 'timeUp' ? "Time's up!" : run.endReason === 'outOfLives' ? 'Out of lives' : run.mode === 'daily' ? 'Daily complete!' : 'Game over';
  const byId = new Map(words.map((w) => [w.id, w]));

  const share = async () => {
    const record = run.dailyDate ? dailyHistory[run.dailyDate] : undefined;
    const text = record
      ? dailyShareText(record, displayedDailyStreak(stats.lastDailyDate, stats.dailyStreak, localDateKey()))
      : runShareText(run.score, run.solved, MODE_LABEL[run.mode]);
    const outcome = await shareText(text);
    if (outcome === 'copied') setShareMessage('Result copied to your clipboard.');
  };

  const playAgain = () => {
    useGame.getState().reset();
    router.replace({ pathname: '/game', params: { mode: run.mode, difficulty: run.difficulty, category: run.categoryId ?? '' } });
  };

  const goHome = () => {
    useGame.getState().reset();
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <Text style={{ fontSize: 56 }}>{run.solved > 0 ? '🏆' : '💪'}</Text>
        <AppText variant="caption" muted>
          {MODE_LABEL[run.mode]} · {DIFFICULTY_INFO[run.difficulty].label}
        </AppText>
        <AppText variant="title">{headline}</AppText>
        <AppText variant="display" color={colors.primary} style={{ fontSize: 56 }} testID="final-score">
          {run.score}
        </AppText>
        <AppText muted>points</AppText>
      </Animated.View>

      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginBottom: spacing.lg }}>
        <Stat icon="✅" value={`${run.solved}/${run.attempted}`} label="Solved" />
        <Stat icon="🎯" value={`${accuracy}%`} label="Accuracy" />
        <Stat icon="🔥" value={run.bestStreak} label="Best streak" />
        <Stat icon="⏱️" value={`${avgSeconds.toFixed(1)}s`} label="Avg time" />
      </Row>

      {reward && (
        <Animated.View entering={FadeInDown.delay(150)}>
          <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-around' }}>
              <AppText variant="heading" color={colors.primary}>
                +{reward.xpGained} XP
              </AppText>
              <AppText variant="heading" color={colors.warning}>
                +{reward.coinsGained} 🪙
              </AppText>
            </Row>
            {run.mode === 'daily' && reward.xpGained === 0 && <Notice text="You already earned today's daily reward." />}
            {reward.levelAfter > reward.levelBefore && <Notice tone="success" text={`🎉 Level up! You reached level ${reward.levelAfter}.`} />}
            {reward.newAchievements.map((a) => (
              <Notice key={a.id} tone="success" text={`${a.icon} Achievement unlocked: ${a.title} (+${a.coinReward} 🪙)`} />
            ))}
          </Card>
        </Animated.View>
      )}

      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        {run.mode !== 'daily' && <Button label="Play again" icon="↻" size="lg" onPress={playAgain} testID="play-again" />}
        <Button label={run.mode === 'daily' ? 'Share result' : 'Share score'} icon="📤" variant="secondary" onPress={() => void share()} />
        {shareMessage && <Notice tone="success" text={shareMessage} />}
        <Button label="Home" variant="ghost" onPress={goHome} />
      </View>

      {run.rounds.length > 0 && (
        <Section title="Words this game">
          <Card style={{ gap: spacing.md }}>
            {run.rounds.map((r, i) => {
              const entry = byId.get(r.wordId);
              return (
                <View key={`${r.wordId}-${i}`} style={{ gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <AppText variant="heading" color={r.solved ? colors.success : colors.danger}>
                      {r.solved ? '✓' : '✗'} {r.word}
                    </AppText>
                    <AppText variant="small" muted>
                      {r.solved ? `${r.seconds.toFixed(1)}s` : 'missed'}
                      {r.hints.length ? ` · 💡${r.hints.length}` : ''}
                    </AppText>
                  </Row>
                  {entry && (
                    <AppText variant="small" muted>
                      {entry.definition}
                    </AppText>
                  )}
                </View>
              );
            })}
          </Card>
        </Section>
      )}
    </Screen>
  );
}
