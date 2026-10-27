import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, FadeIn, LetterTile, Screen, TopBar } from '../components/ui';
import { msUntilTomorrow, puzzleNumber } from '../engine/daily';
import { letterValue } from '../engine/letters';
import { bestPossible, shareText, summarize } from '../engine/results';
import type { PlayedWord, Session } from '../engine/session';
import { useApp } from '../state/AppContext';
import { TITLE_FONT } from '../theme';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function ResultsScreen({ session, onHome, onPractice }: { session: Session; onHome: () => void; onPractice: () => void }) {
  const { theme: t } = useApp();
  const r = summarize(session);
  const best = useMemo(() => bestPossible(session), [session]);
  const [left, setLeft] = useState(msUntilTomorrow());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilTomorrow()), 1000);
    return () => clearInterval(id);
  }, []);

  const share = async () => {
    const text = shareText(session, puzzleNumber(session.dateKey));
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      return;
    }
    try {
      await Share.share({ message: text });
    } catch {
      await Clipboard.setStringAsync(text);
      setCopied(true);
    }
  };

  const top = new Set(r.topWords);
  return (
    <Screen>
      <TopBar title={session.mode === 'daily' ? `No. ${puzzleNumber(session.dateKey)}` : 'Practice'} onBack={onHome} />
      <ScrollView contentContainerStyle={styles.body}>
        <FadeIn style={[styles.medal, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[styles.kicker, { color: t.muted }]}>Top {session.rules.topWordsForShare} score</Text>
          <CountUp value={r.shareScore} style={[styles.score, { color: t.ink }]} />
          <View style={[styles.rule, { backgroundColor: t.accent }]} />
        </FadeIn>

        {r.words.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>No words this round</Text>
            <Text style={{ color: t.muted, marginTop: 4, lineHeight: 20 }}>
              {best
                ? 'You didn’t submit any words. Your letters could still make words. See the best one below.'
                : 'No valid words were formed from the letters you collected. Try more force or a pass-through ball to collect more letters.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14, alignSelf: 'stretch' }}>
            {r.words.map((w, i) => <FadeIn key={i} delay={200 + i * 90}><WordRow w={w} top={top.has(w)} /></FadeIn>)}
          </View>
        )}

        <Text style={[styles.meta, { color: t.muted }]}>
          {r.words.length} {r.words.length === 1 ? 'word' : 'words'} · total {r.total}
          {r.unused.length ? ` · unused ${r.unused.join(' ')}` : ''}
        </Text>

        {best && (
          <FadeIn delay={260 + r.words.length * 90} style={[styles.best, { backgroundColor: t.surface, borderColor: best.found ? t.success : t.accent }]}>
            <View accessible accessibilityLabel={best.found ? `You found the best word possible: ${best.word}, ${best.score} points` : `Best word you could have made: ${best.word}, ${best.score} points, from drop ${best.drop}`}>
              <Text style={[styles.kicker, { color: t.muted }]}>{best.found ? 'You found the best word' : 'Best word you could have made'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                  {best.word.split('').map((l, i) => <LetterTile key={i} letter={l} size={28} />)}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: t.ink }}>{best.score}</Text>
              </View>
              {!best.found && <Text style={{ color: t.muted, fontSize: 13, marginTop: 6 }}>From your letters on drop {best.drop}.</Text>}
            </View>
          </FadeIn>
        )}

        <View style={styles.actions}>
          <Button label={copied ? 'Copied to clipboard' : 'Share'} onPress={share} />
          <Button label="Practice" variant="secondary" onPress={onPractice} />
          <Button label="Home" variant="ghost" onPress={onHome} />
        </View>

        {session.mode === 'daily' && (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={[styles.kicker, { color: t.muted }]}>Next puzzle in</Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: t.ink, fontFamily: TITLE_FONT, fontVariant: ['tabular-nums'] }}>{fmt(left)}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function WordRow({ w, top }: { w: PlayedWord; top: boolean }) {
  const { theme: t } = useApp();
  return (
    <View style={styles.wordRow} accessible accessibilityLabel={`${w.word}, ${w.score} points${top ? ', counts toward share score' : ''}`}>
      <View style={{ flexDirection: 'row', gap: 3, flex: 1, flexWrap: 'wrap' }}>
        {w.letters.map((l, i) => (
          <LetterTile key={i} letter={l.letter} value={l.blank ? 0 : letterValue(l.letter)} size={32} filled={top} color={l.blank ? t.muted : undefined} />
        ))}
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: top ? t.primary : t.muted, minWidth: 44, textAlign: 'right' }}>{w.score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 22, alignItems: 'center', gap: 18, paddingBottom: 40 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  score: { fontSize: 64, fontWeight: '700', fontFamily: TITLE_FONT, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  medal: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 18, borderRadius: 24, borderWidth: 1 },
  rule: { width: 40, height: 4, borderRadius: 2, marginTop: 2 },
  empty: { padding: 16, borderRadius: 18, borderWidth: 1, alignSelf: 'stretch' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { fontSize: 14, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12 },
  best: { alignSelf: 'stretch', padding: 14, borderRadius: 18, borderWidth: 1.5, borderLeftWidth: 5 },
});


/** Ticks the share score up from zero; jumps straight to the value under reduced motion. */
function CountUp({ value, style }: { value: number; style: React.ComponentProps<typeof Text>['style'] }) {
  const { settings } = useApp();
  const [shown, setShown] = useState(settings.reducedMotion ? value : 0);
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (settings.reducedMotion || value === 0) return;
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    Animated.timing(v, { toValue: value, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Text accessibilityRole="header" accessibilityLabel={`Score ${value}`} style={style}>{shown}</Text>;
}
