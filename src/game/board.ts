import { Rng } from './core';

/**
 * Pure model of the letter board.
 *
 * - `tiles` are the scrambled letters in the tray (each has a stable id).
 * - `slots` are the answer positions; each holds a tile id or null.
 * - `locked` slots were revealed by a hint and cannot be changed.
 *
 * Tapping a tray tile places it in the first free slot; tapping a placed
 * tile (in the tray or in its slot) sends it back. This gives players full
 * control to select, deselect and rearrange letters.
 */
export interface Tile {
  id: number;
  letter: string;
}

export interface BoardState {
  word: string;
  tiles: Tile[];
  slots: (number | null)[];
  locked: boolean[];
}

export function createBoard(word: string, scrambled: string): BoardState {
  return {
    word,
    tiles: scrambled.split('').map((letter, id) => ({ id, letter })),
    slots: Array.from({ length: word.length }, () => null),
    locked: Array.from({ length: word.length }, () => false),
  };
}

export function slotOfTile(state: BoardState, tileId: number): number {
  return state.slots.indexOf(tileId);
}

export function isTileUsed(state: BoardState, tileId: number): boolean {
  return state.slots.includes(tileId);
}

export function letterOf(state: BoardState, tileId: number | null): string {
  if (tileId === null) return '';
  return state.tiles.find((t) => t.id === tileId)?.letter ?? '';
}

/** Tap on a tray tile: place it, or take it back if it is already placed. */
export function toggleTile(state: BoardState, tileId: number): BoardState {
  const at = slotOfTile(state, tileId);
  if (at >= 0) return removeFromSlot(state, at);
  const free = state.slots.findIndex((s, i) => s === null && !state.locked[i]);
  if (free < 0) return state;
  const slots = [...state.slots];
  slots[free] = tileId;
  return { ...state, slots };
}

export function removeFromSlot(state: BoardState, slotIndex: number): BoardState {
  if (state.locked[slotIndex] || state.slots[slotIndex] === null) return state;
  const slots = [...state.slots];
  slots[slotIndex] = null;
  return { ...state, slots };
}

/** Remove the most recently filled unlocked slot (Backspace on keyboards). */
export function removeLast(state: BoardState): BoardState {
  for (let i = state.slots.length - 1; i >= 0; i -= 1) {
    if (state.slots[i] !== null && !state.locked[i]) return removeFromSlot(state, i);
  }
  return state;
}

/** Place the first unused tile showing `letter` (keyboard typing). */
export function typeLetter(state: BoardState, letter: string): BoardState {
  const upper = letter.toUpperCase();
  const tile = state.tiles.find((t) => t.letter === upper && !isTileUsed(state, t.id));
  return tile ? toggleTile(state, tile.id) : state;
}

export function clearBoard(state: BoardState): BoardState {
  return { ...state, slots: state.slots.map((s, i) => (state.locked[i] ? s : null)) };
}

export function shuffleTray(state: BoardState, rng: Rng = Math.random): BoardState {
  const tiles = [...state.tiles];
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { ...state, tiles };
}

export function currentAnswer(state: BoardState): string {
  return state.slots.map((id) => letterOf(state, id)).join('');
}

export function isComplete(state: BoardState): boolean {
  return state.slots.every((s) => s !== null);
}

/**
 * Reveal the correct letter at `position` and lock it. A tile carrying that
 * letter is taken from the tray, or moved out of a wrong slot if necessary.
 */
export function revealPosition(state: BoardState, position: number): BoardState {
  if (position < 0 || position >= state.word.length || state.locked[position]) return state;
  const needed = state.word[position];
  const slots = [...state.slots];
  const locked = [...state.locked];

  // Already correct? Just lock it.
  if (letterOf(state, slots[position]) === needed) {
    locked[position] = true;
    return { ...state, slots, locked };
  }

  const candidates = state.tiles.filter((t) => t.letter === needed);
  // Prefer an unused tile, then one sitting in a wrong, unlocked slot.
  const unused = candidates.find((t) => !slots.includes(t.id));
  const movable = candidates.find((t) => {
    const at = slots.indexOf(t.id);
    return at >= 0 && !locked[at] && state.word[at] !== t.letter;
  });
  const fallback = candidates.find((t) => {
    const at = slots.indexOf(t.id);
    return at >= 0 && !locked[at];
  });
  const tile = unused ?? movable ?? fallback;
  if (!tile) return state;

  const from = slots.indexOf(tile.id);
  if (from >= 0) slots[from] = null;
  slots[position] = tile.id; // any tile previously here returns to the tray
  locked[position] = true;
  return { ...state, slots, locked };
}

/** Choose a random position that is not locked yet (excluding the first letter when requested). */
export function pickRevealPosition(state: BoardState, rng: Rng = Math.random, skipFirst = false): number {
  const open = state.locked
    .map((isLocked, i) => (!isLocked && !(skipFirst && i === 0) ? i : -1))
    .filter((i) => i >= 0);
  if (open.length === 0) return -1;
  return open[Math.floor(rng() * open.length)];
}
