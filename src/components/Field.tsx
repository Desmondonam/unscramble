import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './ui';

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16, minHeight: 48 },
});
