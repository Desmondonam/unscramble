import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { AnswerSlots, LetterTray, fitSize } from '@/components/game/Board';
import { BoardState, createBoard, removeFromSlot, toggleTile } from '@/game/board';
import { TILE_THEMES } from '@/theme/tokens';

function Harness({ word, scrambled }: { word: string; scrambled: string }) {
  const [board, setBoard] = useState<BoardState>(createBoard(word, scrambled));
  return (
    <>
      <AnswerSlots board={board} theme={TILE_THEMES[0]} status="idle" shakeKey={0} successKey={0} onSlotPress={(i) => setBoard((b) => removeFromSlot(b, i))} />
      <LetterTray board={board} theme={TILE_THEMES[0]} onTilePress={(id) => setBoard((b) => toggleTile(b, id))} />
    </>
  );
}

describe('letter board UI', () => {
  it('places tapped letters into the answer in order and lets players remove them', async () => {
    await render(<Harness word="CAT" scrambled="TAC" />);
    await fireEvent.press(screen.getByLabelText('Letter C'));
    await fireEvent.press(screen.getByLabelText('Letter A'));
    expect(screen.getByLabelText('Position 1: C')).toBeTruthy();
    expect(screen.getByLabelText('Position 2: A')).toBeTruthy();
    expect(screen.getByLabelText('Position 3: empty')).toBeTruthy();
    // Tapping a placed letter in the slots sends it back.
    await fireEvent.press(screen.getByLabelText('Position 1: C'));
    expect(screen.getByLabelText('Position 1: empty')).toBeTruthy();
    // Tapping a used tile in the tray also removes it.
    await fireEvent.press(screen.getByLabelText('Letter A, placed. Tap to remove'));
    expect(screen.getByLabelText('Position 2: empty')).toBeTruthy();
  });

  it('marks used tiles as selected for screen readers', async () => {
    await render(<Harness word="DOG" scrambled="GOD" />);
    await fireEvent.press(screen.getByLabelText('Letter D'));
    expect(screen.getByLabelText('Letter D, placed. Tap to remove').props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('responsive tile sizing', () => {
  it('fits short words at the maximum size on phones and desktops', () => {
    expect(fitSize(5, 328, 52, 28)).toBe(52);
    expect(fitSize(5, 656, 52, 28)).toBe(52);
  });

  it('wraps very long words onto two rows on narrow phones instead of shrinking illegibly', () => {
    const size = fitSize(14, 280, 52, 28); // 320px-wide phone
    expect(size).toBeGreaterThanOrEqual(28);
    const perRow = Math.ceil(14 / 2);
    expect(perRow * size + (perRow - 1) * 6).toBeLessThanOrEqual(280);
  });

  it('keeps a single row on wide screens', () => {
    const size = fitSize(14, 656, 52, 28);
    expect(14 * size + 13 * 6).toBeLessThanOrEqual(656);
    expect(size).toBeGreaterThanOrEqual(28);
  });
});
