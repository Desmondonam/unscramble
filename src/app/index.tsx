import { Redirect } from 'expo-router';
import { useSettings } from '@/store/settingsStore';

export default function Index() {
  const onboardingDone = useSettings((s) => s.onboardingDone);
  return <Redirect href={onboardingDone ? '/(tabs)' : '/onboarding'} />;
}
