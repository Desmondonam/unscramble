import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'daily-reminder';

export const remindersSupported = Platform.OS !== 'web';

/** Ask for permission and schedule (or replace) the daily reminder. Returns false if denied. */
export async function scheduleDailyReminder(hour: number): Promise<boolean> {
  if (!remindersSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Your daily puzzle is ready 🧩',
      body: 'Keep your streak alive — today’s five words are waiting.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  if (!remindersSupported) return;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
}

export function configureNotificationHandler(): void {
  if (!remindersSupported) return;
  try {
    setHandler();
  } catch (error) {
    console.warn('Notifications unavailable', error);
  }
}

function setHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
