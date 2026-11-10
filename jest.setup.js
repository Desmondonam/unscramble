/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Native notification APIs are not available in Jest.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
