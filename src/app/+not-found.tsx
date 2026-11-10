import { useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen back>
      <EmptyState
        icon="🧩"
        title="This page got scrambled"
        body="We couldn't find what you were looking for."
        action={<Button label="Go home" onPress={() => router.replace('/(tabs)')} />}
      />
    </Screen>
  );
}
