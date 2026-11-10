import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { AnswerSlots, LetterTray } from '@/components/game/Board';
import { AppText, Button, Card, EmptyState, Notice, Pill, PressableScale, ProgressBar, Row, Screen } from '@/components/ui';
import { isComplete } from '@/game/board';
import { DAILY_DIFFICULTY_PATTERN, DIFFICULTIES, Difficulty, GameMode, HINT_COIN_COST, HintType, localDateKey } from '@/game/core';
import { DIFFICULTY_INFO, MODE_LABEL } from '@/game/difficultyInfo';
import { maskExample } from '@/game/words';
import { confirm } from '@/lib/confirm';
import { feedback as haptics } from '@/lib/feedback';
import { selectIsPremium, useAuth } from '@/store/authStore';
import { getVocabulary, useContent } from '@/store/contentStore';
import { timeLeft, useGame } from '@/store/gameStore';
import { useProgress } from '@/store/progressStore';
import { useSettings } from '@/store/settingsStore';
import { radius, spacing } from '@/theme/tokens';
import { useTheme, useTileTheme } from '@/theme/useTheme';

const HINTS: { type: HintType; icon: string; label: string }[] = [
  { type: 'firstLetter', icon: '🔤', label: 'First letter' },
  { type: 'position', icon: '📍', label: 'Reveal a letter' },
  { type: 'definition', icon: '📖', label: 'Definition' },
];

export default function GameScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const tileTheme = useTileTheme();
  const params = useLocalSearchParams<{ mode?: string; difficulty?: string; category?: string }>();
  const mode: GameMode = (['classic', 'timed', 'daily', 'categories'] as const).find((m) => m === params.mode) ?? 'classic';
  const difficulty: Difficulty = DIFFICULTIES.find((d) => d === params.difficulty) ?? 'easy';
  const categoryId = params.category || null;

  const game = useGame();
  const lives = useProgress((s) => s.lives);
  const coins = useProgress((s) => s.stats.coins);
  const freeHintsLeft = useProgress((s) => s.freeHintsLeft);
  useProgress((s) => s.freeHintsUsed); // re-render when free hints change
  const isPremium = useAuth(selectIsPremium);
  const content = useContent();
  const timedDuration = useSettings((s) => s.timedDuration);
  const progressive = useSettings((s) => s.progressiveClassic);

  const [status, setStatus] = useState<'loading' | 'ready' | 'blocked' | 'error'>('loading');
  const [blockedReason, setBlockedReason] = useState('');
  const [hintMessage, setHintMessage] = useState<{ text: string; tone: 'info' | 'danger' } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(false);

  // ---- Start the session --------------------------------------------------
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const today = localDateKey();
      if (mode === 'daily' && useProgress.getState().dailyHistory[today]) {
        setBlockedReason("You've already completed today's challenge. Come back tomorrow!");
        setStatus('blocked');
        return;
      }
      const daily = mode === 'daily' ? await content.getDaily(today) : undefined;
      const premiumIds = content.config.premiumCategoryIds;
      const lockedCategories = isPremium ? [] : content.categories.filter((c) => c.isPremium || premiumIds.includes(c.id)).map((c) => c.id);
      const ok = useGame.getState().start({
        mode,
        difficulty,
        categoryId,
        timedDuration,
        progressive,
        daily,
        words: content.words,
        vocabulary: getVocabulary(content.words),
        rules: content.rules,
        config: content.config,
        isPremium,
        excludedCategoryIds: lockedCategories,
      });
      if (!ok) {
        setBlockedReason(
          useProgress.getState().lives <= 0 && mode !== 'timed' && mode !== 'daily'
            ? 'You are out of lives. They refill over time — or play the Timed Challenge meanwhile.'
            : 'No words are available for this selection right now.',
        );
        setStatus('blocked');
        return;
      }
      setStatus('ready');
    })().catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => useGame.getState().reset(), []);

  // ---- Timer --------------------------------------------------------------
  useEffect(() => {
    if (mode !== 'timed' || status !== 'ready') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      useGame.getState().tick(t);
    }, 250);
    return () => clearInterval(id);
  }, [mode, status]);

  // ---- Feedback → advance -------------------------------------------------
  useEffect(() => {
    const fb = game.feedback;
    if (!fb) return;
    if (fb.kind === 'correct') haptics.success();
    else if (fb.kind === 'wrong') haptics.error();
    else haptics.warning();
    if (game.phase !== 'feedback') return;
    const delay = fb.kind === 'correct' ? (mode === 'timed' ? 650 : 1100) : 1800;
    const id = setTimeout(() => {
      setHintMessage(null);
      useGame.getState().advance();
    }, delay);
    return () => clearTimeout(id);
  }, [game.feedback, game.phase, mode]);

  // ---- Finished → results -------------------------------------------------
  useEffect(() => {
    if (game.phase !== 'finished') return;
    if (game.result) router.replace('/results');
    else router.back();
  }, [game.phase, game.result, router]);

  // ---- Keyboard support (desktop web) ---------------------------------------
  const submit = useCallback(() => {
    useGame.getState().submit();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const g = useGame.getState();
      if (/^[a-z]$/i.test(e.key)) g.typeLetter(e.key);
      else if (e.key === 'Backspace') g.backspace();
      else if (e.key === 'Enter') g.submit();
      else if (e.key === 'Escape') g.clear();
      else if (e.key === ' ') g.shuffle();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const quit = async () => {
    const g = useGame.getState();
    if (g.rounds.length === 0) {
      g.reset();
      router.back();
      return;
    }
    const message = mode === 'daily' ? 'Your daily progress will be lost and you can start again.' : 'Your score so far will be saved.';
    if (await confirm('End this game?', message, 'End game', true)) g.finish('quit');
  };

  const takeHint = (type: HintType) => {
    const result = useGame.getState().applyHint(type);
    if (result.ok) {
      haptics.impact();
      const suffix = result.via === 'coins' ? ` (−${result.cost} 🪙)` : '';
      setHintMessage(type === 'definition' ? null : { text: result.message + suffix, tone: 'info' });
    } else {
      setHintMessage({ text: result.message, tone: 'danger' });
    }
  };

  const current = game.current;
  const board = game.board;
  const fb = game.feedback;
  const rule = current ? content.rules[current.entry.difficulty] : null;
  const category = content.categories.find((c) => c.id === current?.entry.categoryId);
  const remaining = timeLeft(game.deadline, now);
  const hintsLeftToday = freeHintsLeft(content.config);
  const hintsFree = isPremium && content.config.premiumUnlimitedHints;
  const slotStatus = fb?.kind === 'correct' && game.phase === 'feedback' ? 'correct' : fb?.kind === 'wrong' ? 'wrong' : 'idle';

  if (status === 'loading') {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 120 }} color={colors.primary} />
      </Screen>
    );
  }
  if (status === 'blocked' || status === 'error') {
    return (
      <Screen back>
        <EmptyState
          icon={status === 'error' ? '⚠️' : '⏳'}
          title={status === 'error' ? 'Something went wrong' : 'Not right now'}
          body={status === 'error' ? 'We could not start the game. Please try again.' : blockedReason}
          action={<Button label="Back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }
  if (!current || !board) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 120 }} color={colors.primary} />
      </Screen>
    );
  }

  const dailyIndex = game.rounds.length;

  return (
    <Screen scroll>
      {/* Header */}
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <PressableScale
          onPress={() => void quit()}
          accessibilityRole="button"
          accessibilityLabel="End game"
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <AppText variant="heading">✕</AppText>
        </PressableScale>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <AppText variant="caption" muted>
            {MODE_LABEL[mode]}
          </AppText>
          <AppText variant="title" accessibilityLabel={`Score ${game.score}`} testID="score">
            {game.score}
          </AppText>
        </View>
        <Row gap={6}>
          {game.streak > 1 && <Pill icon="🔥" text={game.streak} />}
          {(mode === 'classic' || mode === 'categories') && <Pill icon="❤️" text={lives} />}
          {mode === 'daily' && <Pill icon="🧩" text={`${Math.min(dailyIndex + 1, 5)}/5`} />}
        </Row>
      </Row>

      {mode === 'timed' && (
        <View style={{ marginBottom: spacing.md }} accessibilityLabel={`${remaining} seconds left`}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <AppText variant="small" muted>
              Time left
            </AppText>
            <AppText variant="heading" color={remaining <= 10 ? colors.danger : colors.text}>
              {remaining}s
            </AppText>
          </Row>
          <ProgressBar ratio={remaining / game.timedDuration} color={remaining <= 10 ? colors.danger : colors.warning} />
        </View>
      )}

      {mode === 'daily' && (
        <Row gap={6} style={{ justifyContent: 'center', marginBottom: spacing.md }}>
          {DAILY_DIFFICULTY_PATTERN.map((_, i) => {
            const r = game.rounds[i];
            const bg = r ? (r.solved ? colors.success : colors.danger) : i === dailyIndex ? colors.primary : colors.border;
            return <View key={i} style={{ width: 28, height: 8, borderRadius: 4, backgroundColor: bg }} />;
          })}
        </Row>
      )}

      {/* Puzzle card */}
      <Card style={{ paddingVertical: spacing.xl }}>
        <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: spacing.sm }} gap={6}>
          {category && <Pill icon={category.icon} text={category.name} />}
          <Pill icon={DIFFICULTY_INFO[current.entry.difficulty].icon} text={DIFFICULTY_INFO[current.entry.difficulty].label} />
          <Pill icon="🔠" text={`${current.entry.length} letters`} />
        </Row>

        {current.hints.includes('definition') && (
          <Animated.View entering={FadeInDown} style={[styles.definition, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="small" muted>
              DEFINITION
            </AppText>
            <AppText>{current.entry.definition}</AppText>
            {current.entry.example ? (
              <AppText variant="small" muted style={{ marginTop: 4, fontStyle: 'italic' }}>
                “{maskExample(current.entry.example, current.entry.word)}”
              </AppText>
            ) : null}
          </Animated.View>
        )}

        <AnswerSlots
          board={board}
          theme={tileTheme}
          status={slotStatus}
          shakeKey={fb?.kind === 'wrong' ? fb.id : 0}
          successKey={fb?.kind === 'correct' ? fb.id : 0}
          onSlotPress={game.tapSlot}
        />

        <LetterTray board={board} theme={tileTheme} onTilePress={game.tapTile} />

        {/* Feedback */}
        <View style={{ minHeight: 52, justifyContent: 'center' }}>
          {fb && (
            <Animated.View key={fb.id} entering={ZoomIn.springify()} exiting={FadeOutUp}>
              {fb.kind === 'correct' && (
                <View style={[styles.banner, { backgroundColor: colors.successBg }]}>
                  <Text style={styles.bannerIcon}>🎉</Text>
                  <AppText variant="heading" color={colors.success}>
                    {fb.alternative ? `Also correct! We had ${fb.word}.` : 'Correct!'} +{fb.points}
                  </AppText>
                  {fb.lifeRestored && <AppText color={colors.success}> ❤️ +1</AppText>}
                </View>
              )}
              {fb.kind === 'wrong' && (
                <View style={[styles.banner, { backgroundColor: colors.dangerBg }]}>
                  <Text style={styles.bannerIcon}>🙈</Text>
                  <AppText variant="small" color={colors.danger}>
                    Not quite.
                    {fb.penaltySeconds ? ` −${fb.penaltySeconds}s` : ''}
                    {fb.livesLeft !== null ? ` ${fb.livesLeft} ${fb.livesLeft === 1 ? 'life' : 'lives'} left.` : ''}
                    {fb.attemptsLeft !== null ? ` ${fb.attemptsLeft} ${fb.attemptsLeft === 1 ? 'try' : 'tries'} left.` : ''}
                  </AppText>
                </View>
              )}
              {fb.kind === 'revealed' && (
                <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.bannerIcon}>💡</Text>
                  <AppText variant="small">
                    The word was <AppText variant="heading">{fb.word}</AppText>
                  </AppText>
                </View>
              )}
            </Animated.View>
          )}
          {!fb && hintMessage && <Notice tone={hintMessage.tone} text={hintMessage.text} />}
        </View>

        {/* Actions */}
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
          <Button label="Shuffle" icon="🔀" variant="secondary" size="sm" onPress={game.shuffle} style={{ flex: 1 }} disabled={game.phase !== 'playing'} />
          <Button label="Clear" icon="↺" variant="secondary" size="sm" onPress={game.clear} style={{ flex: 1 }} disabled={game.phase !== 'playing'} />
          <Button label="Skip" icon="⏭" variant="secondary" size="sm" onPress={() => game.skip()} style={{ flex: 1 }} disabled={game.phase !== 'playing'} />
        </Row>
        <Button
          label="Submit"
          size="lg"
          onPress={submit}
          disabled={game.phase !== 'playing' || !isComplete(board)}
          style={{ marginTop: spacing.md }}
          testID="submit"
        />
      </Card>

      {/* Hints */}
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
        <AppText variant="heading">Hints</AppText>
        <AppText variant="small" muted>
          {hintsFree ? 'Premium: free hints' : hintsLeftToday > 0 ? `${hintsLeftToday} free today` : `🪙 ${coins}`}
          {rule ? ` · ${rule.maxHintsPerWord - current.hints.length} left for this word` : ''}
        </AppText>
      </Row>
      <Row gap={spacing.sm}>
        {HINTS.map((h) => {
          const used = current.hints.includes(h.type);
          const limitReached = rule ? current.hints.length >= rule.maxHintsPerWord : false;
          const firstLocked = h.type === 'firstLetter' && board.locked[0];
          const cost = hintsFree || hintsLeftToday > 0 ? 'free' : `${HINT_COIN_COST[h.type]} 🪙`;
          return (
            <PressableScale
              key={h.type}
              accessibilityRole="button"
              accessibilityLabel={`${h.label} hint, ${used ? 'used' : cost}`}
              accessibilityState={{ disabled: used || limitReached || firstLocked || game.phase !== 'playing' }}
              disabled={used || limitReached || firstLocked || game.phase !== 'playing'}
              onPress={() => takeHint(h.type)}
              style={[
                styles.hint,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: used || limitReached || firstLocked ? 0.45 : 1 },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{h.icon}</Text>
              <AppText variant="small" center numberOfLines={1}>
                {h.label}
              </AppText>
              <AppText variant="caption" muted>
                {used ? 'used' : cost}
              </AppText>
            </PressableScale>
          );
        })}
      </Row>

      {Platform.OS === 'web' && (
        <AppText variant="small" muted center style={{ marginTop: spacing.lg }}>
          Keyboard: type letters · Backspace to undo · Enter to submit · Space to shuffle · Esc to clear
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  definition: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, padding: spacing.md, flexWrap: 'wrap' },
  bannerIcon: { fontSize: 20 },
  hint: { flex: 1, alignItems: 'center', gap: 2, borderRadius: radius.lg, borderWidth: 1, paddingVertical: spacing.md, paddingHorizontal: 4 },
});
