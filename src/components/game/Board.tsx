import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BoardState, isTileUsed, letterOf } from '@/game/board';
import { feedback } from '@/lib/feedback';
import { MAX_CONTENT_WIDTH } from '@/components/ui';
import { TileTheme, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const GAP = 6;

/** Fit `count` squares into the available width, wrapping into two rows when they would get too small. */
export function fitSize(count: number, available: number, max: number, min: number): number {
  const single = Math.floor((available - (count - 1) * GAP) / count);
  if (single >= min) return Math.min(max, single);
  const perRow = Math.ceil(count / 2);
  return Math.max(min * 0.8, Math.min(max, Math.floor((available - (perRow - 1) * GAP) / perRow)));
}

function useAvailableWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width, MAX_CONTENT_WIDTH) - 32 - 40; // screen padding + card padding/borders
}

export function LetterTile({
  letter,
  used,
  size,
  theme,
  onPress,
  index,
}: {
  letter: string;
  used: boolean;
  size: number;
  theme: TileTheme;
  onPress: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(withSpring(used ? 1 : 0, { damping: 14, stiffness: 220 }));
  }, [used, lift]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - lift.value * 0.12 }, { translateY: lift.value * 2 }],
    opacity: 1 - lift.value * 0.6,
  }));

  return (
    <Animated.View entering={ZoomIn.delay(index * 35).springify()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Letter ${letter}${used ? ', placed. Tap to remove' : ''}`}
        accessibilityState={{ selected: used }}
        onPress={() => {
          feedback.tap();
          onPress();
        }}
        hitSlop={4}
      >
        <Animated.View
          style={[
            styles.tile,
            {
              width: size,
              height: size + 4,
              backgroundColor: used ? colors.surfaceAlt : theme.face,
              borderBottomColor: used ? colors.border : theme.edge,
              borderColor: used ? colors.border : theme.edge,
            },
            animated,
          ]}
        >
          <Text style={[styles.tileText, { fontSize: size * 0.48, color: used ? colors.textMuted : theme.text }]}>{letter}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function AnswerSlots({
  board,
  shakeKey,
  successKey,
  onSlotPress,
  theme,
  status,
}: {
  board: BoardState;
  shakeKey: number;
  successKey: number;
  onSlotPress: (i: number) => void;
  theme: TileTheme;
  status: 'idle' | 'correct' | 'wrong';
}) {
  const { colors } = useTheme();
  const available = useAvailableWidth();
  const size = fitSize(board.word.length, available, 52, 28);
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!shakeKey) return;
    shake.set(withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    ));
  }, [shakeKey, shake]);

  useEffect(() => {
    if (!successKey) return;
    pop.set(withSequence(withSpring(1.04, { damping: 10 }), withSpring(1)));
  }, [successKey, pop]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: pop.value }] }));
  const borderColor = status === 'correct' ? colors.success : status === 'wrong' ? colors.danger : colors.slotBorder;

  return (
    <Animated.View style={[styles.slots, animated]} accessibilityLabel={`Your answer: ${board.slots.map((s) => letterOf(board, s) || 'blank').join(' ')}`}>
      {board.slots.map((tileId, i) => {
        const letter = letterOf(board, tileId);
        const locked = board.locked[i];
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={letter ? `Position ${i + 1}: ${letter}${locked ? ', revealed' : ''}` : `Position ${i + 1}: empty`}
            disabled={!letter || locked}
            onPress={() => {
              feedback.tap();
              onSlotPress(i);
            }}
          >
            <View
              style={[
                styles.slot,
                {
                  width: size,
                  height: size + 6,
                  backgroundColor: letter ? (locked ? colors.successBg : theme.face) : colors.slot,
                  borderColor: locked ? colors.success : letter ? theme.edge : borderColor,
                },
              ]}
            >
              {letter ? (
                <Animated.Text entering={FadeIn.duration(120)} style={[styles.slotText, { fontSize: size * 0.5, color: locked ? colors.success : theme.text }]}>
                  {letter}
                </Animated.Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

export function LetterTray({ board, onTilePress, theme }: { board: BoardState; onTilePress: (id: number) => void; theme: TileTheme }) {
  const available = useAvailableWidth();
  const size = fitSize(board.tiles.length, available, 60, 40);
  return (
    <View style={styles.tray} key={board.word + board.tiles.map((t) => t.id).join('')}>
      {board.tiles.map((tile, index) => (
        <LetterTile
          key={tile.id}
          index={index}
          letter={tile.letter}
          used={isTileUsed(board, tile.id)}
          size={size}
          theme={theme}
          onPress={() => onTilePress(tile.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP, marginVertical: 8 },
  slot: { borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  slotText: { fontWeight: '900' },
  tray: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP + 4, marginVertical: 12 },
  tile: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderBottomWidth: 5,
  },
  tileText: { fontWeight: '900' },
});
