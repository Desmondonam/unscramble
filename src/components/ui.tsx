import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { feedback } from '@/lib/feedback';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export const MAX_CONTENT_WIDTH = 720;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = keyof typeof typography;

export function AppText({
  variant = 'body',
  color,
  muted,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; muted?: boolean; center?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  title,
  back = false,
  right,
  edges = ['top', 'left', 'right'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  title?: string;
  back?: boolean;
  right?: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.content, contentStyle]}>
      {(title || back) && <ScreenHeader title={title} back={back} right={right} />}
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, back, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <AppText variant="heading">‹</AppText>
        </Pressable>
      ) : null}
      {title ? (
        <AppText variant="title" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors, dark } = useTheme();
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow, shadowOpacity: dark ? 0.4 : 0.08 },
    style,
  ];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <PressableScale onPress={onPress} style={cardStyle} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {children}
    </PressableScale>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {action}
      </Row>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function PressableScale({ children, style, onPress, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Layout props must live on the outer Pressable so `flex: 1` etc. size the touch target.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const { flex, flexGrow, flexShrink, flexBasis, alignSelf, width, minWidth, maxWidth, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, ...inner } = flat;
  const outer: ViewStyle = { flex, flexGrow, flexShrink, flexBasis, alignSelf, width, minWidth, maxWidth, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical };
  const innerStyle: ViewStyle = { ...inner, ...(flex !== undefined || flexGrow !== undefined || alignSelf === 'stretch' ? { flexGrow: 1 } : {}) };
  return (
    <Pressable
      {...rest}
      style={outer}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.96, { damping: 20, stiffness: 400 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 15, stiffness: 300 }));
      }}
    >
      <Animated.View style={[innerStyle, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  size = 'md',
  style,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
    success: { bg: colors.success, fg: '#FFFFFF', border: colors.success },
  };
  const p = palette[variant];
  const pad = size === 'lg' ? 18 : size === 'sm' ? 8 : 13;
  const inactive = disabled || loading;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[
        styles.button,
        { backgroundColor: p.bg, borderColor: p.border, paddingVertical: pad, opacity: inactive ? 0.5 : 1 },
        variant === 'primary' && styles.buttonRaised,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text numberOfLines={1} style={[styles.buttonText, { color: p.fg, fontSize: size === 'lg' ? 18 : size === 'sm' ? 13 : 16 }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress: () => void; color?: string }) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[
        styles.chip,
        { borderColor: selected ? accent : colors.border, backgroundColor: selected ? accent : colors.surface },
      ]}
    >
      <AppText variant="small" color={selected ? '#FFFFFF' : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
          >
            <AppText variant="small" color={active ? colors.primary : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function ProgressBar({ ratio, color, height = 10 }: { ratio: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  const width = useSharedValue(clamped);
  React.useEffect(() => {
    width.set(withTiming(clamped, { duration: 500 }));
  }, [clamped, width]);
  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? colors.primary }, animated]} />
    </View>
  );
}

export function Stat({ icon, value, label, color }: { icon: string; value: string | number; label: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statIcon}>{icon}</Text>
      <AppText variant="heading" color={color}>
        {value}
      </AppText>
      <AppText variant="caption" muted numberOfLines={2} center style={{ letterSpacing: 0.5 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Pill({ icon, text, color }: { icon: string; text: string | number; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <AppText variant="small" color={color}>
        {text}
      </AppText>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44 }}>{icon}</Text>
      <AppText variant="heading" center>
        {title}
      </AppText>
      <AppText muted center>
        {body}
      </AppText>
      {action}
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'success' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  const map = {
    info: { bg: colors.surfaceAlt, fg: colors.text },
    success: { bg: colors.successBg, fg: colors.success },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    warning: { bg: colors.surfaceAlt, fg: colors.warning },
  };
  return (
    <View style={[styles.notice, { backgroundColor: map[tone].bg }]} accessibilityLiveRegion="polite">
      <AppText variant="small" color={map[tone].fg}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, minHeight: 44 },
  backButton: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  button: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 44,
  },
  buttonRaised: Platform.select({
    web: { boxShadow: '0 6px 0 rgba(0,0,0,0.18)' } as ViewStyle,
    default: { shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 3 },
  }) as ViewStyle,
  buttonText: { fontWeight: '800' },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, minHeight: 36, justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, minHeight: 40, justifyContent: 'center' },
  stat: { flex: 1, minWidth: 72, alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderWidth: 1, gap: 2 },
  statIcon: { fontSize: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  notice: { borderRadius: radius.md, padding: spacing.md },
});
