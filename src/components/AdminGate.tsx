import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import { isBackendConfigured } from '@/lib/env';
import { selectIsAdmin, useAuth } from '@/store/authStore';
import { Button, EmptyState, Screen } from './ui';

/**
 * Client-side gate for admin screens. This is UX only — every admin
 * operation is enforced on the server by RLS policies using `is_admin()`.
 */
export function AdminGate({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const isAdmin = useAuth(selectIsAdmin);
  if (!isBackendConfigured() || !isAdmin) {
    return (
      <Screen back title={title}>
        <EmptyState
          icon="🔒"
          title="Administrators only"
          body="Sign in with an administrator account to use the dashboard."
          action={<Button label="Back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }
  return <>{children}</>;
}
