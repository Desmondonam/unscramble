import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Chip, Notice, Row, Screen } from '@/components/ui';
import { difficultyForLength, normalizeWord } from '@/game/core';
import { confirm } from '@/lib/confirm';
import { deleteWord, saveWord, validateWordInput } from '@/lib/admin';
import { getSupabase } from '@/lib/supabase';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';

function WordForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const categories = useContent((s) => s.categories);
  const [word, setWord] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSupabase()
      ?.from('words')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setWord(data.word);
        setCategoryId(data.category_id);
        setDefinition(data.definition);
        setExample(data.example ?? '');
        setPronunciation(data.pronunciation ?? '');
        setActive(data.is_active);
      });
  }, [id]);

  const save = async () => {
    const problem = validateWordInput({ word, definition, example, category_id: categoryId });
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await saveWord({ id, word, category_id: categoryId, definition, example, pronunciation, is_active: active });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !(await confirm('Delete this word?', 'Prefer deactivating — deleting removes it from past daily challenges history lookups.', 'Delete', true))) return;
    try {
      await deleteWord(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const difficulty = difficultyForLength(normalizeWord(word).length);

  return (
    <Screen back title={id ? 'Edit word' : 'Add word'}>
      <Card style={{ gap: spacing.md }}>
        <Field label="Word (A–Z)" value={word} onChangeText={(t) => setWord(t.toUpperCase())} autoCapitalize="characters" editable={!id} />
        <AppText variant="small" muted>
          Difficulty: {difficulty ?? 'too short'} (derived from length)
        </AppText>
        <AppText variant="small" muted>
          Category
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {categories.map((c) => (
            <Chip key={c.id} label={`${c.icon} ${c.name}`} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </ScrollView>
        <Field label="Definition" value={definition} onChangeText={setDefinition} multiline />
        <Field label="Example sentence (must contain the word)" value={example} onChangeText={setExample} multiline />
        <Field label="Pronunciation (optional)" value={pronunciation} onChangeText={setPronunciation} placeholder="/ˈæp.əl/" />
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="heading">Active</AppText>
          <Switch value={active} onValueChange={setActive} accessibilityLabel="Active" />
        </Row>
        {error && <Notice tone="danger" text={error} />}
        <Button label="Save" onPress={() => void save()} loading={busy} />
        {id && <Button label="Delete" variant="danger" onPress={() => void remove()} />}
      </Card>
    </Screen>
  );
}

export default function AdminWord() {
  return (
    <AdminGate title="Word">
      <WordForm />
    </AdminGate>
  );
}
