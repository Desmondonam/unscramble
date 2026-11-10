/**
 * End-to-end UI flows rendered with the real route tree (expo-router/testing-library).
 */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { localDateKey } from '@/game/core';
import { useGame } from '@/store/gameStore';
import { useProgress } from '@/store/progressStore';
import { useSettings } from '@/store/settingsStore';

jest.setTimeout(60_000);

/** Tap the right tiles for the current word, like a player would. */
async function solveCurrentWord() {
  const board = useGame.getState().board!;
  for (let i = 0; i < board.word.length; i += 1) {
    const b = useGame.getState().board!;
    if (b.locked[i]) continue;
    const tile = b.tiles.find((t) => t.letter === b.word[i] && !b.slots.includes(t.id))!;
    await act(async () => useGame.getState().tapTile(tile.id));
  }
  await fireEvent.press(screen.getByTestId('submit'));
}

beforeEach(() => {
  useProgress.getState().resetProgress();
  useSettings.getState().reset();
  useGame.getState().reset();
});

it('shows onboarding on first launch and lets a guest start playing', async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  expect(await screen.findByText('Unscramble the letters')).toBeTruthy();
  await fireEvent.press(screen.getByText('Skip'));
  expect(await screen.findByText('Your choices')).toBeTruthy();
  await fireEvent.press(screen.getByText(/Play as guest/));
  expect(await screen.findByText('Ready to play?')).toBeTruthy();
  expect(useSettings.getState().onboardingDone).toBe(true);
  // Analytics is opt-in: skipping the toggle means no consent.
  expect(useSettings.getState().analyticsConsent).toBe('denied');
});

it('plays a classic game from the home screen and scores points', async () => {
  useSettings.getState().set({ onboardingDone: true });
  await renderRouter('./src/app', { initialUrl: '/' });
  await fireEvent.press(await screen.findByTestId('play-now'));
  await fireEvent.press(await screen.findByText('Classic'));
  await fireEvent.press(await screen.findByTestId('start-game'));
  await waitFor(() => expect(useGame.getState().phase).toBe('playing'));
  expect(screen.getByTestId('submit')).toBeTruthy();

  await solveCurrentWord();
  await waitFor(() => expect(useGame.getState().score).toBeGreaterThan(0));
  expect(await screen.findByText(/Correct!/)).toBeTruthy();
});

it('completes the daily challenge, shows results and blocks a replay', async () => {
  useSettings.getState().set({ onboardingDone: true });
  await renderRouter('./src/app', { initialUrl: '/daily' });
  await fireEvent.press(await screen.findByTestId('play-daily'));
  await waitFor(() => expect(useGame.getState().phase).toBe('playing'));

  for (let i = 0; i < 5; i += 1) {
    await waitFor(() => expect(useGame.getState().phase).toBe('playing'));
    await solveCurrentWord();
    await act(async () => useGame.getState().advance());
  }

  expect(await screen.findByText('Daily complete!')).toBeTruthy();
  const today = localDateKey();
  expect(useProgress.getState().dailyHistory[today].results).toEqual(['solved', 'solved', 'solved', 'solved', 'solved']);
  expect(useProgress.getState().stats.dailyStreak).toBe(1);

  // Trying to play again today is refused.
  await act(async () => useGame.getState().reset());
  await act(async () => screen.unmount());
  await renderRouter('./src/app', { initialUrl: '/game?mode=daily' });
  expect(await screen.findByText(/already completed today/)).toBeTruthy();
});

it('switches to the dark theme from settings', async () => {
  useSettings.getState().set({ onboardingDone: true });
  await renderRouter('./src/app', { initialUrl: '/settings' });
  await fireEvent.press(await screen.findByText('Dark'));
  expect(useSettings.getState().themeMode).toBe('dark');
});
