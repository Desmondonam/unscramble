import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettings } from '@/store/settingsStore';

/** Haptic feedback that respects the player's setting and never throws (e.g. on web). */
function run(effect: () => Promise<void>) {
  if (Platform.OS === 'web' || !useSettings.getState().haptics) return;
  effect().catch(() => undefined);
}

export const feedback = {
  tap: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  impact: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
