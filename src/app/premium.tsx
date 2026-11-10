import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { AppText, Button, Card, Notice, Row, Screen } from '@/components/ui';
import { track } from '@/lib/analytics';
import { PREMIUM_BENEFITS, PremiumProduct, getBilling } from '@/lib/monetization';
import { selectIsPremium, useAuth } from '@/store/authStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Premium() {
  const router = useRouter();
  const { colors } = useTheme();
  const isPremium = useAuth(selectIsPremium);
  const premiumUntil = useAuth((s) => s.profile?.premiumUntil);
  const user = useAuth((s) => s.user);
  const billing = getBilling();
  const [products, setProducts] = useState<PremiumProduct[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  useEffect(() => {
    track('premium_viewed');
    if (billing.isAvailable()) billing.getProducts().then(setProducts).catch(() => setProducts([]));
  }, [billing]);

  const buy = async (id: string) => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setBusy(id);
    try {
      const outcome = await billing.purchase(id);
      if (outcome === 'purchased') {
        track('premium_converted', { product: id });
        // Entitlement is granted server-side by the billing webhook; refresh to pick it up.
        await useAuth.getState().refreshProfile();
        setMessage({ tone: 'success', text: 'Welcome to Premium! 🎉' });
      }
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Purchase failed.' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const restored = await billing.restore();
      await useAuth.getState().refreshProfile();
      setMessage(restored ? { tone: 'success', text: 'Purchases restored.' } : { tone: 'info', text: 'No previous purchases found.' });
    } finally {
      setBusy(null);
    }
  };

  const manageUrl = billing.manageSubscriptionsUrl();

  return (
    <Screen back title="Premium">
      <Card style={{ alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.lg }}>
        <Text style={{ fontSize: 52 }}>👑</Text>
        <AppText variant="title" color="#FFFFFF" center>
          {isPremium ? "You're Premium" : 'Unscramble Premium'}
        </AppText>
        <AppText color="#FFFFFFDD" center>
          {isPremium
            ? premiumUntil
              ? `Active until ${new Date(premiumUntil).toLocaleDateString()}.`
              : 'Thanks for supporting the game!'
            : 'More hints, more themes, no ads — and you support new word packs.'}
        </AppText>
      </Card>

      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {PREMIUM_BENEFITS.map((b) => (
          <Card key={b.title}>
            <Row gap={spacing.md}>
              <Text style={{ fontSize: 26 }}>{b.icon}</Text>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{b.title}</AppText>
                <AppText variant="small" muted>
                  {b.body}
                </AppText>
              </View>
            </Row>
          </Card>
        ))}
      </View>

      {message && (
        <View style={{ marginBottom: spacing.md }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      {isPremium ? (
        manageUrl ? <Button label="Manage subscription" variant="secondary" onPress={() => void Linking.openURL(manageUrl)} /> : null
      ) : billing.isAvailable() && products.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {products.map((p) => (
            <Button key={p.id} label={`${p.title} · ${p.priceLabel}`} size="lg" onPress={() => void buy(p.id)} loading={busy === p.id} disabled={!!busy} />
          ))}
          <Button label="Restore purchases" variant="ghost" onPress={() => void restore()} loading={busy === 'restore'} />
          <AppText variant="small" muted center>
            Subscriptions renew automatically until cancelled in your App Store or Google Play account settings.
          </AppText>
        </View>
      ) : (
        <Notice text="In-app purchases aren't available in this build yet. Premium will be offered through the App Store and Google Play." />
      )}
    </Screen>
  );
}
