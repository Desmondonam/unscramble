import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import type { DailyRecord } from '@/store/progressStore';
import { env } from './env';

/** Wordle-style, spoiler-free result card. */
export function dailyShareText(record: DailyRecord, streak: number): string {
  const squares = record.results.map((r) => (r === 'solved' ? '🟩' : '🟥')).join('');
  const solved = record.results.filter((r) => r === 'solved').length;
  const lines = [
    `Unscramble Daily ${record.date}`,
    `${squares}  ${solved}/${record.results.length}`,
    `⭐ ${record.score} pts · 💡 ${record.hintsUsed} hints · 🔥 ${streak}-day streak`,
  ];
  if (env.webUrl) lines.push(env.webUrl);
  return lines.join('\n');
}

export function runShareText(score: number, solved: number, modeLabel: string): string {
  const lines = [`I scored ${score} points and solved ${solved} words in Unscramble (${modeLabel}). Can you beat me?`];
  if (env.webUrl) lines.push(env.webUrl);
  return lines.join('\n');
}

/** Share via the native sheet; on browsers without Web Share, copy to the clipboard. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        // User cancelled or share failed — fall back to copy.
      }
    }
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
