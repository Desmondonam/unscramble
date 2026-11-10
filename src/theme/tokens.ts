export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  secondary: string;
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
  warning: string;
  info: string;
  shadow: string;
  overlay: string;
  slot: string;
  slotBorder: string;
}

export const lightPalette: Palette = {
  background: '#F5F3FF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEAFE',
  border: '#E1DBFA',
  text: '#1C1838',
  textMuted: '#6B6790',
  primary: '#6C4CF1',
  primaryText: '#FFFFFF',
  secondary: '#FF7A59',
  success: '#12B886',
  successBg: '#DDF8EE',
  danger: '#F03E5E',
  dangerBg: '#FFE3E8',
  warning: '#F59F00',
  info: '#228BE6',
  shadow: '#3B2A8C',
  overlay: 'rgba(20, 16, 48, 0.55)',
  slot: '#EEEAFE',
  slotBorder: '#C9BFF7',
};

export const darkPalette: Palette = {
  background: '#0F0D1F',
  surface: '#1A1733',
  surfaceAlt: '#24204A',
  border: '#332D63',
  text: '#F4F2FF',
  textMuted: '#A7A2CC',
  primary: '#8B70FF',
  primaryText: '#FFFFFF',
  secondary: '#FF8F70',
  success: '#38D9A9',
  successBg: '#123B33',
  danger: '#FF6B86',
  dangerBg: '#43192A',
  warning: '#FFC145',
  info: '#4DABF7',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  slot: '#24204A',
  slotBorder: '#4A4290',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '900' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '800' as const },
  heading: { fontSize: 18, fontWeight: '800' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
};

/** Unlockable letter-tile themes. */
export interface TileTheme {
  id: string;
  name: string;
  face: string;
  edge: string;
  text: string;
  /** How it unlocks: by level, by coins, or by premium. */
  unlock: { type: 'free' } | { type: 'level'; level: number } | { type: 'coins'; cost: number } | { type: 'premium' };
}

export const TILE_THEMES: TileTheme[] = [
  { id: 'sunny', name: 'Sunny', face: '#FFD43B', edge: '#E0A800', text: '#2B2100', unlock: { type: 'free' } },
  { id: 'ocean', name: 'Ocean', face: '#74C0FC', edge: '#1C7ED6', text: '#06223D', unlock: { type: 'level', level: 3 } },
  { id: 'candy', name: 'Candy', face: '#FFA8C5', edge: '#E64980', text: '#3D0A1F', unlock: { type: 'level', level: 5 } },
  { id: 'mint', name: 'Mint', face: '#8CE99A', edge: '#2F9E44', text: '#082B10', unlock: { type: 'coins', cost: 150 } },
  { id: 'sunset', name: 'Sunset', face: '#FFA94D', edge: '#E8590C', text: '#3A1500', unlock: { type: 'coins', cost: 300 } },
  { id: 'galaxy', name: 'Galaxy', face: '#9775FA', edge: '#5F3DC4', text: '#FFFFFF', unlock: { type: 'premium' } },
  { id: 'midnight', name: 'Midnight', face: '#343A40', edge: '#000000', text: '#FFD43B', unlock: { type: 'premium' } },
];

export interface AvatarOption {
  id: string;
  emoji: string;
  unlock: TileTheme['unlock'];
}

export const AVATARS: AvatarOption[] = [
  { id: 'fox', emoji: '🦊', unlock: { type: 'free' } },
  { id: 'owl', emoji: '🦉', unlock: { type: 'free' } },
  { id: 'cat', emoji: '🐱', unlock: { type: 'free' } },
  { id: 'panda', emoji: '🐼', unlock: { type: 'level', level: 2 } },
  { id: 'koala', emoji: '🐨', unlock: { type: 'level', level: 4 } },
  { id: 'tiger', emoji: '🐯', unlock: { type: 'level', level: 6 } },
  { id: 'octopus', emoji: '🐙', unlock: { type: 'coins', cost: 100 } },
  { id: 'unicorn', emoji: '🦄', unlock: { type: 'coins', cost: 250 } },
  { id: 'dragon', emoji: '🐲', unlock: { type: 'level', level: 10 } },
  { id: 'robot', emoji: '🤖', unlock: { type: 'premium' } },
  { id: 'alien', emoji: '👾', unlock: { type: 'premium' } },
  { id: 'crown', emoji: '👑', unlock: { type: 'premium' } },
];

export function avatarEmoji(id: string | null | undefined): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? '🦊';
}
