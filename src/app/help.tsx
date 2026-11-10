import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { AppText, Button, Card, Screen, Section } from '@/components/ui';
import { env } from '@/lib/env';
import { spacing } from '@/theme/tokens';

const FAQ = [
  {
    q: 'How do I play?',
    a: 'Tap the letter tiles in order to build the word in the answer slots. Tap a placed letter (in the slots or the tray) to send it back. When every slot is filled, press Submit. On a computer you can simply type, use Backspace to undo and Enter to submit.',
  },
  {
    q: 'How is my score calculated?',
    a: 'Each word earns base points for its difficulty (Easy 10, Medium 20, Hard 35, Expert 50) plus a bonus for longer words and for solving quickly. Consecutive correct answers multiply your points by up to 2×. Each hint reduces that word’s points by 20% (minimum 40%).',
  },
  {
    q: 'How do hints work?',
    a: 'Three hints are available: reveal the first letter, reveal one correctly placed letter, or show the definition with an example sentence. You get free hints every day; after that hints cost coins. Harder difficulties allow fewer hints per word.',
  },
  {
    q: 'What are lives?',
    a: 'Classic and Category games use lives. A wrong answer or a skip costs one. Lives refill over time, and every 5-word streak restores one. Timed and Daily games never use lives.',
  },
  {
    q: 'How does the Daily Challenge work?',
    a: 'Every day there are five words — the same for every player. You get three tries per word. Rewards are granted once per day, and completing it on consecutive days builds your daily streak.',
  },
  {
    q: 'Why was my answer accepted even though it was a different word?',
    a: 'A few puzzles have two valid answers using the same letters (for example LEMON and MELON). If your word is in our approved vocabulary, it counts.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Guests can play everything and progress is saved on the device. An account lets you sync across devices and appear on leaderboards.',
  },
  {
    q: 'How do I delete my data?',
    a: 'Signed-in players can delete their account and all associated data in Settings → Data. Guests can reset local progress there, or simply uninstall the app.',
  },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen back title="Help & support">
      <Section title="FAQ">
        <View style={{ gap: spacing.sm }}>
          {FAQ.map((item, i) => (
            <Card key={item.q}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)}>
                <AppText variant="heading">
                  {open === i ? '▾' : '▸'} {item.q}
                </AppText>
              </Pressable>
              {open === i && (
                <AppText muted style={{ marginTop: spacing.sm, lineHeight: 22 }}>
                  {item.a}
                </AppText>
              )}
            </Card>
          ))}
        </View>
      </Section>
      <Section title="Contact us">
        <Card style={{ gap: spacing.md }}>
          <AppText muted>Found a bug, a wrong definition or have an idea? We read every message.</AppText>
          <Button
            label={`Email ${env.supportEmail}`}
            icon="✉️"
            onPress={() => void Linking.openURL(`mailto:${env.supportEmail}?subject=${encodeURIComponent('Unscramble support')}`)}
          />
        </Card>
      </Section>
    </Screen>
  );
}
