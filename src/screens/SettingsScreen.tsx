import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Screen, TopBar } from '../components/ui';
import { useApp } from '../state/AppContext';
import type { Settings } from '../storage';

const ROWS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'darkTheme', label: 'Dark theme', hint: 'Easier on the eyes at night' },
  { key: 'highContrast', label: 'High contrast', hint: 'Stronger colors for collected letters' },
  { key: 'haptics', label: 'Haptics', hint: 'Buzz when the ball hits a letter' },
  { key: 'reducedMotion', label: 'Reduced motion', hint: 'Faster, shorter drop animation' },
  { key: 'aimAssist', label: 'Aim assist', hint: 'Show the full path for every ball' },
];

export function SettingsScreen({ onBack, onHowTo }: { onBack: () => void; onHowTo: () => void }) {
  const { theme: t, settings, updateSettings, user, signOut } = useApp();
  return (
    <Screen>
      <TopBar title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {ROWS.map((r) => (
          <View key={r.key} style={[styles.row, { borderBottomColor: t.line }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: t.ink }]}>{r.label}</Text>
              <Text style={[styles.hint, { color: t.muted }]}>{r.hint}</Text>
            </View>
            <Switch
              accessibilityLabel={r.label}
              value={settings[r.key]}
              onValueChange={(v) => updateSettings({ [r.key]: v })}
              trackColor={{ true: t.primary, false: t.line }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
        <View style={styles.footer}>
          <Button label="How to play" variant="secondary" onPress={onHowTo} />
          <Text style={[styles.hint, { color: t.muted, textAlign: 'center' }]}>
            Signed in as {user?.name ?? 'Guest'}{user?.guest ? ' (guest)' : ''}. Everything is stored on this device only.
          </Text>
          <Button label="Sign out" variant="ghost" onPress={signOut} accessibilityHint="Your stats stay on this device" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, minHeight: 64 },
  label: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  footer: { padding: 20, gap: 14 },
});
