import { Alert, Platform } from 'react-native';

/** Cross-platform confirmation dialog (Alert buttons are not supported by react-native-web). */
export function confirm(title: string, message: string, confirmLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${title}\n\n${message}`) : true;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
