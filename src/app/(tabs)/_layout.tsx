import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12, lineHeight: 16, paddingBottom: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="daily" options={{ title: 'Daily', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Ranks', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
