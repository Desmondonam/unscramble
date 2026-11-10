import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Notice, Row, Screen, Section } from '@/components/ui';
import { fetchTable, upsertRow } from '@/lib/admin';
import { DEFAULT_REMOTE_CONFIG } from '@/config/remoteConfig';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
}

interface LevelRow {
  id: string;
  min_length: number;
  max_length: number;
  base_score: number;
  max_hints_per_word: number;
  timed_penalty_seconds: number;
  par_seconds: number;
  coin_reward: number;
}

const LEVEL_FIELDS: (keyof LevelRow)[] = ['min_length', 'max_length', 'base_score', 'max_hints_per_word', 'timed_penalty_seconds', 'par_seconds', 'coin_reward'];

function ContentAdmin() {
  const sync = useContent((s) => s.sync);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [config, setConfig] = useState<{ key: string; value: unknown }[]>([]);
  const [newCat, setNewCat] = useState({ id: '', name: '', icon: '🔤', color: '#6C4CF1' });
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = async () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchTable<CategoryRow>('categories', 'sort_order'),
      fetchTable<LevelRow>('difficulty_levels', 'min_length'),
      fetchTable<{ key: string; value: unknown }>('app_config', 'key'),
    ])
      .then(([cats, lvls, rows]) => {
        if (!active) return;
        setCategories(cats);
        setLevels(lvls);
        setConfig(rows);
        setConfigDraft(Object.fromEntries(rows.map((r) => [r.key, JSON.stringify(r.value)])));
      })
      .catch((e: unknown) => active && setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Failed to load' }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const wrap = async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setMessage({ tone: 'success', text: success });
      await load();
      void sync();
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const addCategory = () => {
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(newCat.id)) return setMessage({ tone: 'danger', text: 'Category id: lowercase letters, digits and dashes.' });
    if (newCat.name.trim().length < 2) return setMessage({ tone: 'danger', text: 'Enter a category name.' });
    void wrap(
      () => upsertRow('categories', { ...newCat, name: newCat.name.trim(), is_premium: false, is_active: true, sort_order: categories.length + 1 }),
      'Category added. Add words to it from the Words screen.',
    );
    setNewCat({ id: '', name: '', icon: '🔤', color: '#6C4CF1' });
  };

  const saveConfig = (key: string) => {
    let value: unknown;
    try {
      value = JSON.parse(configDraft[key] ?? '');
    } catch {
      return setMessage({ tone: 'danger', text: `${key}: value must be valid JSON (e.g. 5, true, ["food"]).` });
    }
    const fallback = (DEFAULT_REMOTE_CONFIG as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined && typeof fallback !== typeof value) {
      return setMessage({ tone: 'danger', text: `${key}: expected a ${Array.isArray(fallback) ? 'list' : typeof fallback}.` });
    }
    void wrap(() => upsertRow('app_config', { key, value }), `${key} updated.`);
  };

  return (
    <Screen back title="Categories & config">
      {message && (
        <View style={{ marginBottom: spacing.md }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      <Section title="Categories">
        <View style={{ gap: spacing.sm }}>
          {categories.map((c) => (
            <Card key={c.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="heading" style={{ flex: 1 }}>
                  {c.icon} {c.name}
                </AppText>
                <AppText variant="small" muted>
                  Premium
                </AppText>
                <Switch value={c.is_premium} accessibilityLabel={`${c.name} premium`} onValueChange={(v) => void wrap(() => upsertRow('categories', { ...c, is_premium: v }), 'Saved.')} />
                <AppText variant="small" muted>
                  Active
                </AppText>
                <Switch value={c.is_active} accessibilityLabel={`${c.name} active`} onValueChange={(v) => void wrap(() => upsertRow('categories', { ...c, is_active: v }), 'Saved.')} />
              </Row>
            </Card>
          ))}
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading">New category</AppText>
            <Field label="Id (e.g. music)" value={newCat.id} onChangeText={(id) => setNewCat({ ...newCat, id })} autoCapitalize="none" />
            <Field label="Name" value={newCat.name} onChangeText={(name) => setNewCat({ ...newCat, name })} />
            <Row gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <Field label="Icon (emoji)" value={newCat.icon} onChangeText={(icon) => setNewCat({ ...newCat, icon })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Colour" value={newCat.color} onChangeText={(color) => setNewCat({ ...newCat, color })} autoCapitalize="none" />
              </View>
            </Row>
            <Button label="Add category" onPress={addCategory} />
          </Card>
        </View>
      </Section>

      <Section title="Difficulty levels">
        <AppText variant="small" muted style={{ marginBottom: spacing.sm }}>
          Used by the app and by server-side score validation. Keep length ranges contiguous and non-overlapping.
        </AppText>
        <View style={{ gap: spacing.sm }}>
          {levels.map((l) => (
            <Card key={l.id} style={{ gap: spacing.sm }}>
              <AppText variant="heading">{l.id}</AppText>
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                {LEVEL_FIELDS.map((field) => (
                  <View key={field} style={{ width: 130 }}>
                    <Field
                      label={field.replace(/_/g, ' ')}
                      value={String(l[field])}
                      keyboardType="number-pad"
                      onChangeText={(t) => setLevels((ls) => ls.map((x) => (x.id === l.id ? { ...x, [field]: Number(t.replace(/\D/g, '')) || 0 } : x)))}
                    />
                  </View>
                ))}
              </Row>
              <Button label={`Save ${l.id}`} size="sm" variant="secondary" onPress={() => void wrap(() => upsertRow('difficulty_levels', { ...l }), `${l.id} saved.`)} />
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Remote config (premium & tuning)">
        <View style={{ gap: spacing.sm }}>
          {config.map((row) => (
            <Card key={row.key} style={{ gap: spacing.sm }}>
              <Field label={row.key} value={configDraft[row.key] ?? ''} onChangeText={(t) => setConfigDraft({ ...configDraft, [row.key]: t })} autoCapitalize="none" />
              <Button label="Save" size="sm" variant="secondary" onPress={() => saveConfig(row.key)} />
            </Card>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

export default function AdminContent() {
  return (
    <AdminGate title="Categories & config">
      <ContentAdmin />
    </AdminGate>
  );
}
