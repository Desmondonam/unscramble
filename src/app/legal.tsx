import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText, Button, Card, Screen, Segmented } from '@/components/ui';
import { env } from '@/lib/env';
import { spacing } from '@/theme/tokens';

/*
 * In-app summary of the privacy policy and terms. The canonical, lawyer-reviewed
 * versions should be hosted at EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_TERMS_URL
 * (required by both app stores). Source text lives in docs/PRIVACY_POLICY.md and
 * docs/TERMS.md — keep them in sync.
 */
const PRIVACY: [string, string][] = [
  ['What we collect', 'If you create an account: your email address, username, avatar choice, game results and synced progress. If you opt in to analytics: anonymous gameplay events (e.g. "game completed", score, difficulty) tied to a random install ID. We do not collect contacts, location, advertising IDs or precise device identifiers.'],
  ['How we use it', 'To run the game, sync your progress across devices, compute leaderboards, prevent cheating and improve difficulty balance. We never sell personal data.'],
  ['Guests', 'Guest progress is stored only on your device. Nothing is sent to our servers unless you opt in to anonymous analytics.'],
  ['Where it is stored', 'Account data is stored with our backend provider (Supabase) using encryption in transit and at rest, protected by row-level security.'],
  ['Your choices', 'You can withdraw analytics consent at any time in Settings. You can delete your account and all associated data in Settings → Data; deletion is immediate and permanent.'],
  ['Children', 'The game is suitable for all ages. We do not knowingly collect personal data from children under 13 without parental consent; children can play in guest mode without providing any personal data.'],
  ['Contact', `Questions or requests: ${env.supportEmail}`],
];

const TERMS: [string, string][] = [
  ['Using the game', 'Unscramble is provided for personal entertainment. Do not attempt to manipulate scores, exploit bugs, or interfere with other players or the service.'],
  ['Accounts', 'You are responsible for keeping your login secure. Usernames must not be offensive or impersonate others; we may rename or remove accounts that break these rules.'],
  ['Virtual items', 'Coins, themes and avatars have no monetary value and cannot be exchanged for money.'],
  ['Purchases', 'Premium subscriptions are sold through the Apple App Store and Google Play and are governed by their terms, including billing, renewal and refunds. Manage or cancel them in your store account settings.'],
  ['Leaderboards', 'Scores are validated by our servers. We may remove scores that appear to be the result of cheating.'],
  ['Changes', 'We may update the game and these terms. Continued use after changes means you accept them.'],
];

export default function Legal() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'privacy' | 'terms'>(params.tab === 'terms' ? 'terms' : 'privacy');
  const sections = tab === 'privacy' ? PRIVACY : TERMS;
  const url = tab === 'privacy' ? env.privacyUrl : env.termsUrl;
  return (
    <Screen back title="Privacy & terms">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'privacy', label: 'Privacy policy' },
          { value: 'terms', label: 'Terms of use' },
        ]}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {sections.map(([title, body]) => (
          <Card key={title}>
            <AppText variant="heading">{title}</AppText>
            <AppText muted style={{ marginTop: 4, lineHeight: 22 }}>
              {body}
            </AppText>
          </Card>
        ))}
        {url ? <Button label="Read the full document" variant="secondary" onPress={() => void Linking.openURL(url)} /> : null}
      </View>
    </Screen>
  );
}
