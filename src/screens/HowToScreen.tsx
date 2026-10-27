import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LetterTile, Screen, TopBar } from '../components/ui';
import { BALL_CONFIGS, BALL_TYPES } from '../engine/ballConfig';
import { letterValue } from '../engine/letters';
import { useApp } from '../state/AppContext';

export function HowToScreen({ onBack }: { onBack: () => void }) {
  const { theme: t } = useApp();
  return (
    <Screen>
      <TopBar title="How to play" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <P>You get <Text style={styles.b}>5 drops</Text>. Each ball you drop collects the letters it touches.</P>
        <P>After each drop, spell a word from your letters (3+ letters) or skip. Unused letters return to their board spots and must be hit again. If no word can be formed, your letters are destroyed and replaced from the tray, and the drop still counts. Your rack clears each turn. Stuck? Tap Suggest for a middle-scoring word, not the best one. The word box shows a live check (✓ Word / ✗ Not a word). Tap a letter in the word to remove it, and tap ⇄ to shuffle your letters. When the game ends, you’ll see the best word you could have made.</P>
        <P>Letters you use are replaced by balls tumbling down from the tray, in the order you collected them.</P>

        <H>Aiming</H>
        <P>Move the ball up, down, left or right between the tray and dotted line. Drag below the line to aim and adjust energy, or drag the energy control or select Small, Medium or Large.</P>
        <P>Precision is locked to Medium force. Its preview stops at the third bounce or halfway down the board, whichever comes first, even with aim assist. The bottom dotted line marks where the drop ends.</P>

        <H>Balls</H>
        {BALL_TYPES.map((bt) => (
          <View key={bt} style={styles.ballRow}>
            <View style={{
              width: 18, height: 18, borderRadius: 9, marginTop: 3,
              backgroundColor: bt === 'pass' ? 'transparent' : t.ball[bt],
              borderWidth: bt === 'pass' ? 3 : 0, borderColor: t.ball[bt], borderStyle: bt === 'pass' ? 'dashed' : 'solid',
            }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.b, { color: t.ink, fontSize: 16 }]}>{BALL_CONFIGS[bt].label}</Text>
              <Text style={[styles.p, { color: t.muted, marginBottom: 0 }]}>{BALL_CONFIGS[bt].description}</Text>
            </View>
          </View>
        ))}

        <H>Scoring</H>
        <P>Each word scores the Scrabble value of its letters. No multipliers.</P>
        <View style={styles.tiles}>
          {'DROP'.split('').map((l) => <LetterTile key={l} letter={l} value={letterValue(l)} size={40} filled />)}
          <Text style={[styles.b, { color: t.ink, fontSize: 18, marginLeft: 8 }]}>= 7</Text>
        </View>
        <P>Every new board has at least one <Text style={styles.b}>?</Text> ball. Blanks let you pick any letter and score 0.</P>
        <P>Your shared score <Text style={styles.b}>⭐</Text> is your top 3 words added together.</P>
        <P>If no word can be made from your letters, the game will tell you. You can keep dropping for more.</P>
      </ScrollView>
    </Screen>
  );
}

function P({ children }: { children: React.ReactNode }) {
  const { theme: t } = useApp();
  return <Text style={[styles.p, { color: t.ink }]}>{children}</Text>;
}

function H({ children }: { children: React.ReactNode }) {
  const { theme: t } = useApp();
  return <Text accessibilityRole="header" style={[styles.h, { color: t.ink }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  body: { padding: 22, paddingBottom: 48 },
  p: { fontSize: 16, lineHeight: 23, marginBottom: 12 },
  h: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginBottom: 10 },
  b: { fontWeight: '800' },
  ballRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
});
