import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText, Card, MAX_CONTENT_WIDTH, Screen } from '@/components/ui';
import { selectIsPremium, useAuth } from '@/store/authStore';
import { useContent } from '@/store/contentStore';
import { spacing } from '@/theme/tokens';

export default function Categories() {
  const router = useRouter();
  const categories = useContent((s) => s.categories);
  const words = useContent((s) => s.words);
  const premiumIds = useContent((s) => s.config.premiumCategoryIds);
  const isPremium = useAuth(selectIsPremium);
  const { width } = useWindowDimensions();
  const columns = Math.min(width, MAX_CONTENT_WIDTH) >= 560 ? 3 : 2;
  const tileWidth = (Math.min(width, MAX_CONTENT_WIDTH) - spacing.lg * 2 - spacing.md * (columns - 1)) / columns;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    words.forEach((w) => w.isActive && map.set(w.categoryId, (map.get(w.categoryId) ?? 0) + 1));
    return map;
  }, [words]);

  return (
    <Screen back title="Categories">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[...categories]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c, i) => {
            const locked = (c.isPremium || premiumIds.includes(c.id)) && !isPremium;
            const count = counts.get(c.id) ?? 0;
            return (
              <Animated.View key={c.id} entering={FadeIn.delay(i * 30)} style={{ width: tileWidth }}>
                <Card
                  accessibilityLabel={`${c.name}, ${count} words${locked ? ', premium' : ''}`}
                  onPress={() =>
                    locked ? router.push('/premium') : router.push({ pathname: '/play/setup', params: { mode: 'categories', category: c.id } })
                  }
                  style={{ alignItems: 'center', gap: 6, borderColor: c.color + '66', minHeight: 130, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 34 }}>{c.icon}</Text>
                  <AppText variant="heading" center numberOfLines={2} style={{ fontSize: 15 }}>
                    {c.name}
                  </AppText>
                  <AppText variant="small" muted>
                    {locked ? '🔒 Premium' : `${count} words`}
                  </AppText>
                </Card>
              </Animated.View>
            );
          })}
      </View>
    </Screen>
  );
}
