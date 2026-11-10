import { useColorScheme } from 'react-native';
import { useProgress } from '@/store/progressStore';
import { useSettings } from '@/store/settingsStore';
import { Palette, TILE_THEMES, TileTheme, darkPalette, lightPalette } from './tokens';

export function useTheme(): { colors: Palette; dark: boolean } {
  const mode = useSettings((s) => s.themeMode);
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return { colors: dark ? darkPalette : lightPalette, dark };
}

export function useTileTheme(): TileTheme {
  const id = useProgress((s) => s.tileThemeId);
  return TILE_THEMES.find((t) => t.id === id) ?? TILE_THEMES[0];
}
