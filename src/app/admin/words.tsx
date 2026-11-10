import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Chip, Notice, Row, Screen } from '@/components/ui';
import { difficultyForLength } from '@/game/core';
import { AdminWord, searchWords, setWordActive } from '@/lib/admin';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function WordList() {
  const router = useRouter();
  const { colors } = useTheme();
  const categories = useContent((s) => s.categories);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchWords({ query, categoryId: categoryId || undefined, page });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load words');
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, page]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = async (w: AdminWord) => {
    try {
      await setWordActive(w.id, !w.is_active);
      setRows((rs) => rs.map((r) => (r.id === w.id ? { ...r, is_active: !r.is_active } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const pages = Math.max(1, Math.ceil(total / 40));

  return (
    <Screen back title="Words" right={<Button label="Add" icon="+" size="sm" onPress={() => router.push('/admin/word')} />}>
      <Field label="Search" value={query} onChangeText={(t) => { setQuery(t); setPage(0); }} autoCapitalize="characters" placeholder="e.g. TIGER" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="All" selected={!categoryId} onPress={() => { setCategoryId(''); setPage(0); }} />
        {categories.map((c) => (
          <Chip key={c.id} label={`${c.icon} ${c.name}`} selected={categoryId === c.id} onPress={() => { setCategoryId(c.id); setPage(0); }} />
        ))}
      </ScrollView>
      {error && <Notice tone="danger" text={error} />}
      <AppText variant="small" muted style={{ marginBottom: spacing.sm }}>
        {total} words · page {page + 1} of {pages}
      </AppText>
      {loading && rows.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <Card style={{ padding: 0 }}>
          {rows.map((w, i) => (
            <Row key={w.id} style={{ padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: w.is_active ? 1 : 0.5 }}>
              <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => router.push({ pathname: '/admin/word', params: { id: w.id } })}>
                <AppText variant="heading">{w.word}</AppText>
                <AppText variant="small" muted numberOfLines={1}>
                  {difficultyForLength(w.word.length)} · {w.category_id} · {w.definition}
                </AppText>
              </Pressable>
              <Button label={w.is_active ? 'Deactivate' : 'Activate'} size="sm" variant={w.is_active ? 'secondary' : 'success'} onPress={() => void toggle(w)} />
            </Row>
          ))}
          {rows.length === 0 && (
            <View style={{ padding: spacing.lg }}>
              <AppText muted>No words match.</AppText>
            </View>
          )}
        </Card>
      )}
      <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
        <Button label="‹ Prev" variant="secondary" size="sm" disabled={page === 0} onPress={() => setPage((p) => p - 1)} style={{ flex: 1 }} />
        <Button label="Next ›" variant="secondary" size="sm" disabled={page + 1 >= pages} onPress={() => setPage((p) => p + 1)} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}

export default function AdminWords() {
  return (
    <AdminGate title="Words">
      <WordList />
    </AdminGate>
  );
}
