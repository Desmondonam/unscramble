import { createRng } from '../core';
import {
  clearBoard,
  createBoard,
  currentAnswer,
  isComplete,
  isTileUsed,
  pickRevealPosition,
  removeFromSlot,
  removeLast,
  revealPosition,
  shuffleTray,
  toggleTile,
  typeLetter,
} from '../board';

describe('board', () => {
  const fresh = () => createBoard('APPLE', 'PPLEA');

  it('places tiles in order and shows the answer in the slots (old bug: slots mirrored tray indices)', () => {
    let b = fresh();
    b = toggleTile(b, 4); // A
    b = toggleTile(b, 0); // P
    expect(currentAnswer(b)).toBe('AP');
    expect(b.slots).toEqual([4, 0, null, null, null]);
  });

  it('deselects a tile when tapped again and refills the earliest gap', () => {
    let b = fresh();
    b = toggleTile(b, 4);
    b = toggleTile(b, 0);
    b = toggleTile(b, 4); // remove A
    expect(b.slots).toEqual([null, 0, null, null, null]);
    b = toggleTile(b, 1);
    expect(b.slots[0]).toBe(1);
  });

  it('completes and clears', () => {
    let b = fresh();
    for (const id of [4, 0, 1, 2, 3]) b = toggleTile(b, id);
    expect(isComplete(b)).toBe(true);
    expect(currentAnswer(b)).toBe('APPLE');
    expect(toggleTile(b, 0).slots.includes(0)).toBe(false);
    b = clearBoard(b);
    expect(b.slots.every((s) => s === null)).toBe(true);
  });

  it('supports typing and backspace', () => {
    let b = fresh();
    b = typeLetter(b, 'a');
    b = typeLetter(b, 'p');
    b = typeLetter(b, 'p');
    b = typeLetter(b, 'z'); // ignored
    expect(currentAnswer(b)).toBe('APP');
    b = removeLast(b);
    expect(currentAnswer(b)).toBe('AP');
  });

  it('reveals a position, locks it and keeps it through clear', () => {
    let b = fresh();
    b = revealPosition(b, 0);
    expect(currentAnswer(b)).toBe('A');
    expect(b.locked[0]).toBe(true);
    b = clearBoard(b);
    expect(currentAnswer(b)).toBe('A');
    expect(removeFromSlot(b, 0)).toBe(b);
    b = typeLetter(b, 'P');
    expect(b.slots[1]).not.toBeNull(); // typing skips locked slots
  });

  it('moves a tile out of a wrong slot when revealing', () => {
    let b = createBoard('AB', 'BA');
    b = toggleTile(b, 1); // A in slot 0
    b = toggleTile(b, 0); // B in slot 1
    b = createBoard('AB', 'BA');
    b = toggleTile(b, 0); // B placed in slot 0 (wrong)
    b = toggleTile(b, 1); // A placed in slot 1 (wrong)
    b = revealPosition(b, 0);
    expect(currentAnswer(b)[0]).toBe('A');
    expect(b.locked[0]).toBe(true);
    expect(isTileUsed(b, 1)).toBe(true);
  });

  it('picks only unlocked positions and can skip the first letter', () => {
    let b = fresh();
    b = revealPosition(b, 0);
    const rng = createRng(1);
    for (let i = 0; i < 30; i += 1) {
      const p = pickRevealPosition(b, rng, true);
      expect(p).toBeGreaterThan(0);
    }
    for (let i = 1; i < 5; i += 1) b = revealPosition(b, i);
    expect(pickRevealPosition(b)).toBe(-1);
    expect(currentAnswer(b)).toBe('APPLE');
  });

  it('shuffles the tray without changing letters', () => {
    const b = shuffleTray(fresh(), createRng(3));
    expect(b.tiles.map((t) => t.letter).sort().join('')).toBe('AELPP');
  });
});
