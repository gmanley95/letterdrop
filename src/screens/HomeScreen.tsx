import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FadeIn, Logo, Screen, Title } from '../components/ui';
import { puzzleNumber } from '../engine/daily';
import { useApp } from '../state/AppContext';
import { TITLE_FONT } from '../theme';

export type DailyStatus = 'new' | 'inProgress' | 'done';

export function HomeScreen({
  today, dailyStatus, onDaily, onPractice, onHowTo, onSettings,
}: {
  today: string;
  dailyStatus: DailyStatus;
  onDaily: () => void;
  onPractice: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}) {
  const { theme: t, user, stats } = useApp();
  const date = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const dailyLabel = dailyStatus === 'done' ? 'See today’s results' : dailyStatus === 'inProgress' ? 'Continue daily' : 'Play daily';

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettings} hitSlop={10} style={[styles.gear, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={{ fontSize: 22, color: t.ink }}>⚙︎</Text>
        </Pressable>
      </View>
      <View style={styles.wrap}>
        <FadeIn style={styles.hero}>
          <Logo size={72} />
          <Title size={42} />
          <Text style={[styles.hello, { color: t.ink }]}>Hi, {user?.name ?? 'Guest'}.</Text>
          <Text style={[styles.sub, { color: t.muted }]}>Five drops. Up to five words. Your top three count.</Text>
        </FadeIn>

        <FadeIn delay={120} style={styles.actions}>
          <Button label={dailyLabel} onPress={onDaily} />
          <Button label="Practice" variant="secondary" onPress={onPractice} accessibilityHint="Random board, does not affect your streak" />
          <Button label="How to play" variant="ghost" onPress={onHowTo} />
        </FadeIn>

        <FadeIn delay={240} style={[styles.stats, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Stat label="Played" value={stats.played} />
          <Stat label="Streak" value={stats.streak} />
          <Stat label="Best ⭐" value={stats.bestShare} />
          <Stat label="Words" value={stats.totalWords} />
        </FadeIn>
        <Text style={[styles.meta, { color: t.muted }]}>{date} · No. {puzzleNumber(today)}</Text>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { theme: t } = useApp();
  return (
    <View style={{ alignItems: 'center', flex: 1 }} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: t.ink, fontFamily: TITLE_FONT }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: t.muted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: 52, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8 },
  gear: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 28, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 8 },
  hello: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  sub: { fontSize: 15, textAlign: 'center' },
  actions: { gap: 12 },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, paddingVertical: 14 },
  meta: { textAlign: 'center', fontSize: 13 },
});
