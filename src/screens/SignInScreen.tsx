import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { Button, FadeIn, Logo, Screen, Title } from '../components/ui';
import { useApp } from '../state/AppContext';

export function SignInScreen() {
  const { theme: t, signIn } = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const go = async (guest: boolean) => {
    setBusy(true);
    await signIn(guest ? 'Guest' : trimmed, guest);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <FadeIn style={styles.hero}>
          <Logo size={84} />
          <Title size={44} />
          <Text style={[styles.tag, { color: t.ink }]}>Drop the ball. Catch the letters.{'\n'}Make your best three words.</Text>
        </FadeIn>

        <FadeIn delay={140} style={[styles.form, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text nativeID="nameLabel" style={[styles.label, { color: t.ink }]}>Your name</Text>
          <TextInput
            accessibilityLabelledBy="nameLabel"
            accessibilityLabel="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sam"
            placeholderTextColor={t.muted}
            maxLength={20}
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={() => trimmed && go(false)}
            style={[styles.input, { color: t.ink, borderColor: t.tileBorder, backgroundColor: t.bg }]}
          />
          <Button label="Continue" onPress={() => go(false)} disabled={!trimmed} loading={busy} />
          <Button label="Play as guest" variant="secondary" onPress={() => go(true)} disabled={busy} />
          <Text style={[styles.note, { color: t.muted }]}>
            Your profile, scores and settings are stored only on this device. No password, no account.
          </Text>
        </FadeIn>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 36 },
  hero: { alignItems: 'center', gap: 10 },
  tag: { fontSize: 17, textAlign: 'center', lineHeight: 25 },
  form: { gap: 12, padding: 18, borderRadius: 22, borderWidth: 1 },
  label: { fontWeight: '700', fontSize: 14 },
  input: { borderWidth: 1.5, minHeight: 52, paddingHorizontal: 16, fontSize: 17, borderRadius: 14 },
  note: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
