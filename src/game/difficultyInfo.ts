import type { Difficulty } from './core';

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; icon: string; color: string; blurb: string }> = {
  easy: { label: 'Easy', icon: '🌱', color: '#12B886', blurb: '3–4 letters · common words · 3 hints per word' },
  medium: { label: 'Medium', icon: '🌿', color: '#228BE6', blurb: '5–6 letters · everyday vocabulary · 3 hints' },
  hard: { label: 'Hard', icon: '🌳', color: '#F59F00', blurb: '7–9 letters · tougher words · 2 hints' },
  expert: { label: 'Expert', icon: '🔥', color: '#F03E5E', blurb: '10+ letters · advanced vocabulary · 1 hint' },
};

export const MODE_LABEL = {
  classic: 'Classic',
  timed: 'Timed Challenge',
  daily: 'Daily Challenge',
  categories: 'Categories',
} as const;
