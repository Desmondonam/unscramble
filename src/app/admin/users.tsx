import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Field } from '@/components/Field';
import { AppText, Button, Card, Notice, Row, Screen } from '@/components/ui';
import { fetchUsers } from '@/lib/admin';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function Users() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchUsers>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchUsers(query.replace(/[^A-Za-z0-9_]/g, ''), page)
        .then(setData)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'));
    }, 250);
    return () => clearTimeout(id);
  }, [query, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / 40)) : 1;

  return (
    <Screen back title="Users">
      <Field label="Search by username" value={query} onChangeText={(t) => { setQuery(t); setPage(0); }} autoCapitalize="none" />
      {error && <Notice tone="danger" text={error} />}
      <AppText variant="small" muted style={{ marginVertical: spacing.sm }}>
        {data?.total ?? 0} users · page {page + 1} of {pages}
      </AppText>
      {!data ? (
        <ActivityIndicator />
      ) : (
        <Card style={{ padding: 0 }}>
          {data.rows.map((u, i) => (
            <Row key={u.id} style={{ padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, justifyContent: 'space-between' }}>
              <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                {u.username}
              </AppText>
              <AppText variant="small" muted>
                {u.role === 'admin' ? '🛠️ admin · ' : ''}
                {u.is_premium ? '👑 · ' : ''}
                {new Date(u.created_at).toLocaleDateString()}
              </AppText>
            </Row>
          ))}
        </Card>
      )}
      <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
        <Button label="‹ Prev" variant="secondary" size="sm" disabled={page === 0} onPress={() => setPage((p) => p - 1)} style={{ flex: 1 }} />
        <Button label="Next ›" variant="secondary" size="sm" disabled={page + 1 >= pages} onPress={() => setPage((p) => p + 1)} style={{ flex: 1 }} />
      </Row>
      <AppText variant="small" muted style={{ marginTop: spacing.md }}>
        Emails are not shown here by design. Role changes are made in SQL (see docs/BACKEND.md) so they are audited.
      </AppText>
    </Screen>
  );
}

export default function AdminUsers() {
  return (
    <AdminGate title="Users">
      <Users />
    </AdminGate>
  );
}
