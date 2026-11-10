import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Notice, ProgressBar, Row, Screen, Section, Stat } from '@/components/ui';
import { ACHIEVEMENTS } from '@/game/achievements';
import { displayedDailyStreak, levelProgress, localDateKey } from '@/game/core';
import { isBackendConfigured } from '@/lib/env';
import { feedback } from '@/lib/feedback';
import { selectIsAdmin, selectIsPremium, useAuth, validateUsername } from '@/store/authStore';
import { isUnlockedByLevel, useProgress } from '@/store/progressStore';
import { AVATARS, TILE_THEMES, TileTheme, avatarEmoji, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function unlockLabel(unlock: TileTheme['unlock']): string {
  if (unlock.type === 'level') return `Lv ${unlock.level}`;
  if (unlock.type === 'coins') return `${unlock.cost} 🪙`;
  if (unlock.type === 'premium') return '👑';
  return '';
}

export default function Profile() {
  const router = useRouter();
  const { colors } = useTheme();
  const progress = useProgress();
  const auth = useAuth();
  const isPremium = useAuth(selectIsPremium);
  const isAdmin = useAuth(selectIsAdmin);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(progress.username);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const { stats } = progress;
  const level = levelProgress(stats.xp);
  const displayName = auth.profile?.username || progress.username || 'Guest player';
  const accuracy = stats.wordsAttempted ? Math.round((stats.wordsSolved / stats.wordsAttempted) * 100) : 0;
  const avgSolve = stats.wordsSolved ? (stats.totalSeconds / Math.max(1, stats.wordsAttempted)).toFixed(1) : '0.0';
  const unlockedCount = Object.keys(progress.achievements).length;

  const saveName = async () => {
    const problem = validateUsername(name);
    if (problem) {
      setMessage({ tone: 'danger', text: problem });
      return;
    }
    try {
      if (auth.user) await auth.updateProfile({ username: name });
      progress.setProfile({ username: name });
      setEditing(false);
      setMessage({ tone: 'success', text: 'Username saved.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Could not save username.' });
    }
  };

  const chooseAvatar = (id: string) => {
    if (progress.unlockAvatar(id, isPremium)) {
      feedback.tap();
      progress.setProfile({ avatarId: id });
      if (auth.user) void auth.updateProfile({ avatarId: id }).catch(() => undefined);
    } else {
      const a = AVATARS.find((x) => x.id === id)!;
      if (a.unlock.type === 'premium') router.push('/premium');
      else setMessage({ tone: 'danger', text: a.unlock.type === 'coins' ? `You need ${a.unlock.cost} coins for this avatar.` : `Reach level ${a.unlock.type === 'level' ? a.unlock.level : ''} to unlock.` });
    }
  };

  const chooseTheme = (theme: TileTheme) => {
    if (progress.unlockTheme(theme, isPremium)) {
      feedback.tap();
      progress.setProfile({ tileThemeId: theme.id });
    } else if (theme.unlock.type === 'premium') router.push('/premium');
    else
      setMessage({
        tone: 'danger',
        text: theme.unlock.type === 'coins' ? `You need ${theme.unlock.cost} coins for ${theme.name}.` : `Reach level ${theme.unlock.type === 'level' ? theme.unlock.level : ''} to unlock ${theme.name}.`,
      });
  };

  return (
    <Screen title="Profile" right={<Button label="⚙️" variant="secondary" size="sm" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />}>
      <Card style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 48 }}>{avatarEmoji(progress.avatarId)}</Text>
        </View>
        {editing ? (
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <Field label="Username" value={name} onChangeText={setName} autoCapitalize="none" maxLength={20} />
            <Row gap={spacing.sm}>
              <Button label="Save" onPress={() => void saveName()} style={{ flex: 1 }} />
              <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            </Row>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit username" onPress={() => setEditing(true)}>
            <AppText variant="title">{displayName} ✏️</AppText>
          </Pressable>
        )}
        <AppText muted variant="small">
          {auth.user ? (auth.user.email ?? 'Signed in') : 'Guest · progress saved on this device'}
          {isPremium ? ' · 👑 Premium' : ''}
        </AppText>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <AppText variant="heading">Level {level.level}</AppText>
            <AppText variant="small" muted>
              {stats.xp.toLocaleString()} XP total
            </AppText>
          </Row>
          <ProgressBar ratio={level.ratio} />
        </View>
      </Card>

      {message && (
        <View style={{ marginBottom: spacing.lg }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      <Section title="Stats">
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          <Stat icon="⭐" value={stats.xp.toLocaleString()} label="Total score" />
          <Stat icon="🏅" value={stats.bestScore} label="Best game" />
          <Stat icon="🎮" value={stats.gamesPlayed} label="Games" />
        </Row>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
          <Stat icon="📖" value={stats.wordsSolved} label="Words" />
          <Stat icon="🔥" value={stats.bestStreak} label="Best streak" />
          <Stat icon="📅" value={displayedDailyStreak(stats.lastDailyDate, stats.dailyStreak, localDateKey())} label="Daily streak" />
        </Row>
      </Section>

      <Section title="Advanced stats" action={!isPremium ? <AppText variant="small" muted>👑 Premium</AppText> : undefined}>
        {isPremium ? (
          <Card style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Accuracy</AppText>
              <AppText variant="heading">{accuracy}%</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Average time per word</AppText>
              <AppText variant="heading">{avgSolve}s</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Hints per solved word</AppText>
              <AppText variant="heading">{stats.wordsSolved ? (stats.hintsUsed / stats.wordsSolved).toFixed(2) : '0'}</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Expert words solved</AppText>
              <AppText variant="heading">{stats.expertSolved}</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Categories explored</AppText>
              <AppText variant="heading">{stats.categoriesSolved.length}/12</AppText>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText>Best Timed score</AppText>
              <AppText variant="heading">{stats.bestTimedScore}</AppText>
            </Row>
          </Card>
        ) : (
          <Card onPress={() => router.push('/premium')} accessibilityLabel="Unlock advanced statistics with Premium">
            <AppText muted>Accuracy, average solve time, hint usage and more. Tap to learn about Premium.</AppText>
          </Card>
        )}
      </Section>

      <Section title={`Achievements · ${unlockedCount}/${ACHIEVEMENTS.length}`} action={<Button label="View all" size="sm" variant="ghost" onPress={() => router.push('/achievements')} />}>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {ACHIEVEMENTS.slice(0, 8).map((a) => (
            <View
              key={a.id}
              accessible
              accessibilityLabel={`${a.title}${progress.achievements[a.id] ? ', unlocked' : ', locked'}`}
              style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, opacity: progress.achievements[a.id] ? 1 : 0.3 }}
            >
              <Text style={{ fontSize: 24 }}>{a.icon}</Text>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Avatar">
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {AVATARS.map((a) => {
            const owned = progress.unlockedAvatars.includes(a.id) || isUnlockedByLevel(a.unlock, level.level, isPremium);
            const selected = a.id === progress.avatarId;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`Avatar ${a.id}${owned ? '' : `, locked ${unlockLabel(a.unlock)}`}${selected ? ', selected' : ''}`}
                onPress={() => chooseAvatar(a.id)}
                style={{
                  width: 56,
                  height: 64,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ fontSize: 28, opacity: owned ? 1 : 0.35 }}>{a.emoji}</Text>
                {!owned && <AppText variant="caption" muted>{unlockLabel(a.unlock)}</AppText>}
              </Pressable>
            );
          })}
        </Row>
      </Section>

      <Section title="Tile theme">
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {TILE_THEMES.map((t) => {
            const owned = progress.unlockedThemes.includes(t.id) || isUnlockedByLevel(t.unlock, level.level, isPremium);
            const selected = t.id === progress.tileThemeId;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`${t.name} theme${owned ? '' : `, locked ${unlockLabel(t.unlock)}`}${selected ? ', selected' : ''}`}
                onPress={() => chooseTheme(t)}
                style={{ alignItems: 'center', gap: 4, padding: 6, borderRadius: radius.md, borderWidth: 2, borderColor: selected ? colors.primary : 'transparent' }}
              >
                <View style={{ width: 44, height: 48, borderRadius: 12, backgroundColor: t.face, borderColor: t.edge, borderWidth: 1.5, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center', opacity: owned ? 1 : 0.4 }}>
                  <Text style={{ fontWeight: '900', fontSize: 20, color: t.text }}>A</Text>
                </View>
                <AppText variant="caption" muted>
                  {owned ? t.name : unlockLabel(t.unlock)}
                </AppText>
              </Pressable>
            );
          })}
        </Row>
      </Section>

      <Section title="Account">
        <View style={{ gap: spacing.sm }}>
          {isBackendConfigured() && !auth.user && <Button label="Sign in or create account" icon="☁️" onPress={() => router.push('/auth')} />}
          <Button label={isPremium ? 'Premium · manage' : 'Go Premium'} icon="👑" variant="secondary" onPress={() => router.push('/premium')} />
          {isAdmin && <Button label="Admin dashboard" icon="🛠️" variant="secondary" onPress={() => router.push('/admin')} />}
          <Button label="Help & support" icon="❓" variant="secondary" onPress={() => router.push('/help')} />
          <Button label="Privacy & terms" icon="🔒" variant="secondary" onPress={() => router.push('/legal')} />
          {auth.user && <Button label="Sign out" variant="ghost" onPress={() => void auth.signOut()} />}
        </View>
      </Section>
    </Screen>
  );
}
