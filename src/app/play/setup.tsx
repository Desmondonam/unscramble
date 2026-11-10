import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { useLives } from '@/components/LivesIndicator';
import { AppText, Button, Card, Chip, Notice, Row, Screen, Section } from '@/components/ui';
import { DIFFICULTIES, Difficulty, TIMED_DURATIONS } from '@/game/core';
import { DIFFICULTY_INFO } from '@/game/difficultyInfo';
import { useContent } from '@/store/contentStore';
import { useSettings } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';


export default function Setup() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string; category?: string; difficulty?: string }>();
  const mode = params.mode === 'timed' || params.mode === 'categories' ? params.mode : 'classic';
  const settings = useSettings();
  const rules = useContent((s) => s.rules);
  const category = useContent((s) => s.categories.find((c) => c.id === params.category));
  const initial = DIFFICULTIES.includes(params.difficulty as Difficulty) ? (params.difficulty as Difficulty) : 'easy';
  const [difficulty, setDifficulty] = useState<Difficulty>(initial);
  const { lives, refillIn } = useLives();
  const needsLives = mode !== 'timed';
  const outOfLives = needsLives && lives <= 0;

  const title = mode === 'timed' ? 'Timed Challenge' : mode === 'categories' ? `${category?.icon ?? ''} ${category?.name ?? 'Category'}` : 'Classic';

  const start = () =>
    router.replace({
      pathname: '/game',
      params: { mode, difficulty, category: mode === 'categories' ? (params.category ?? '') : '' },
    });

  return (
    <Screen back title={title}>
      <Section title="Difficulty">
        <View style={{ gap: spacing.sm }}>
          {DIFFICULTIES.map((d) => {
            const info = DIFFICULTY_INFO[d];
            const selected = d === difficulty;
            return (
              <Card
                key={d}
                onPress={() => setDifficulty(d)}
                accessibilityLabel={`${info.label}. ${info.blurb}${selected ? '. Selected' : ''}`}
                style={{ borderColor: selected ? info.color : colors.border, borderWidth: selected ? 2.5 : 1 }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">
                      {info.icon} {info.label}
                    </AppText>
                    <AppText variant="small" muted>
                      {info.blurb}
                    </AppText>
                  </View>
                  <AppText variant="small" color={info.color}>
                    {rules[d].baseScore} pts
                  </AppText>
                </Row>
              </Card>
            );
          })}
        </View>
      </Section>

      {mode === 'timed' && (
        <Section title="Clock">
          <Row gap={spacing.sm}>
            {TIMED_DURATIONS.map((s) => (
              <Chip key={s} label={`${s} seconds`} selected={settings.timedDuration === s} onPress={() => settings.set({ timedDuration: s })} />
            ))}
          </Row>
          <AppText variant="small" muted style={{ marginTop: spacing.sm }}>
            Wrong answers cost {rules[difficulty].timedPenaltySeconds} seconds on {DIFFICULTY_INFO[difficulty].label}. No lives are used.
          </AppText>
        </Section>
      )}

      {mode === 'classic' && (
        <Card style={{ marginBottom: spacing.xl }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="heading">Progressive difficulty</AppText>
              <AppText variant="small" muted>
                Step up a level after every 5 solved words.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Progressive difficulty"
              value={settings.progressiveClassic}
              onValueChange={(v) => settings.set({ progressiveClassic: v })}
            />
          </Row>
        </Card>
      )}

      {outOfLives && <Notice tone="danger" text={`You're out of lives. Next life in ${refillIn}. Try the Timed Challenge or Daily puzzle meanwhile — they don't use lives.`} />}
      <Button label="Start" icon="▶" size="lg" onPress={start} disabled={outOfLives} style={{ marginTop: spacing.md }} testID="start-game" />
    </Screen>
  );
}
