import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootstrap, useHydrated } from '@/lib/bootstrap';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const hydrated = useHydrated();
  const { colors, dark } = useTheme();

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => undefined);
    return bootstrap();
  }, [hydrated]);

  if (!hydrated) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="game" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="results" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
