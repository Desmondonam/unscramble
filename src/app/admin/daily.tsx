import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Chip, Notice, Row, Screen, Section } from '@/components/ui';
import { DIFFICULTIES, addDays, isValidDateKey, localDateKey } from '@/game/core';
import { deleteRow, fetchDailyChallenges, fetchTable, setDailyChallenge, upsertRow } from '@/lib/admin';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';

interface Featured {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  difficulty: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

function DailyAdmin() {
  const categories = useContent((s) => s.categories);
  const today = localDateKey();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchDailyChallenges>>>([]);
  const [date, setDate] = useState(addDays(today, 1));
  const [words, setWords] = useState('');
  const [title, setTitle] = useState('');
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCategory, setFCategory] = useState<string | null>(null);
  const [fDifficulty, setFDifficulty] = useState('medium');
  const [fDays, setFDays] = useState('7');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = async () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    Promise.all([fetchDailyChallenges(addDays(today, -7), addDays(today, 30)), fetchTable<Featured>('featured_challenges', 'starts_at', false)])
      .then(([daily, feat]) => {
        if (!active) return;
        setRows(daily);
        setFeatured(feat);
      })
      .catch((e: unknown) => active && setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Failed to load' }));
    return () => {
      active = false;
    };
  }, [today, reloadKey]);

  const saveDaily = async () => {
    const list = words.split(/[\s,]+/).filter(Boolean);
    if (!isValidDateKey(date)) return setMessage({ tone: 'danger', text: 'Use a YYYY-MM-DD date.' });
    if (date <= today) return setMessage({ tone: 'danger', text: 'Only future days can be changed — players may already have played today.' });
    if (list.length !== 5) return setMessage({ tone: 'danger', text: 'Enter exactly five words.' });
    try {
      await setDailyChallenge(date, list, title.trim() || null);
      setMessage({ tone: 'success', text: `Daily challenge for ${date} saved.` });
      setWords('');
      setTitle('');
      void load();
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const saveFeatured = async () => {
    if (fTitle.trim().length < 3) return setMessage({ tone: 'danger', text: 'Give the featured challenge a title.' });
    const days = Math.max(1, Math.min(60, Number(fDays) || 7));
    try {
      await upsertRow('featured_challenges', {
        title: fTitle.trim(),
        description: fDesc.trim(),
        category_id: fCategory,
        difficulty: fDifficulty,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + days * 86_400_000).toISOString(),
        is_active: true,
      });
      setFTitle('');
      setFDesc('');
      setMessage({ tone: 'success', text: 'Featured challenge published.' });
      void load();
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <Screen back title="Daily & featured">
      {message && (
        <View style={{ marginBottom: spacing.md }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      <Section title="Schedule a daily challenge">
        <Card style={{ gap: spacing.md }}>
          <AppText variant="small" muted>
            Days without a scheduled puzzle are generated automatically on first request and then fixed for everyone.
          </AppText>
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
          <Field label="Five words (easy → expert recommended)" value={words} onChangeText={setWords} autoCapitalize="characters" placeholder="CAT, APPLE, GARDEN, DOLPHIN, MICROPHONE" />
          <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Ocean week" />
          <Button label="Save daily challenge" onPress={() => void saveDaily()} />
        </Card>
      </Section>

      <Section title="Upcoming & recent">
        <Card style={{ gap: spacing.sm }}>
          {rows.length === 0 && <AppText muted>No materialised challenges in this range.</AppText>}
          {rows.map((r) => (
            <Row key={r.challenge_date} style={{ justifyContent: 'space-between' }}>
              <AppText variant="heading">{r.challenge_date}</AppText>
              <AppText variant="small" muted style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>
                {r.title ? `${r.title} · ` : ''}
                {r.word_ids.map((id) => id.split(':')[1]?.toUpperCase()).join(', ')}
              </AppText>
            </Row>
          ))}
        </Card>
      </Section>

      <Section title="Featured challenges">
        <Card style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Field label="Title" value={fTitle} onChangeText={setFTitle} />
          <Field label="Description" value={fDesc} onChangeText={setFDesc} />
          <AppText variant="small" muted>
            Category (none = mixed classic)
          </AppText>
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
            <Chip label="Mixed" selected={!fCategory} onPress={() => setFCategory(null)} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.icon + ' ' + c.name} selected={fCategory === c.id} onPress={() => setFCategory(c.id)} />
            ))}
          </Row>
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
            {DIFFICULTIES.map((d) => (
              <Chip key={d} label={d} selected={fDifficulty === d} onPress={() => setFDifficulty(d)} />
            ))}
          </Row>
          <Field label="Runs for (days)" value={fDays} onChangeText={setFDays} keyboardType="number-pad" />
          <Button label="Publish featured challenge" onPress={() => void saveFeatured()} />
        </Card>
        <View style={{ gap: spacing.sm }}>
          {featured.map((f) => (
            <Card key={f.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{f.title}</AppText>
                  <AppText variant="small" muted>
                    {f.category_id ?? 'mixed'} · {f.difficulty} · ends {f.ends_at ? new Date(f.ends_at).toLocaleDateString() : 'never'}
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel={`${f.title} active`}
                  value={f.is_active}
                  onValueChange={(v) => void upsertRow('featured_challenges', { ...f, is_active: v }).then(load)}
                />
                <Button label="🗑" variant="ghost" size="sm" accessibilityLabel={`Delete ${f.title}`} onPress={() => void deleteRow('featured_challenges', 'id', f.id).then(load)} />
              </Row>
            </Card>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

export default function AdminDaily() {
  return (
    <AdminGate title="Daily & featured">
      <DailyAdmin />
    </AdminGate>
  );
}
