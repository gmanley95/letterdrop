import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useApp } from '../state/AppContext';
import { TITLE_FONT } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';
const NATIVE = Platform.OS !== 'web';

/** Pill button with a pressed-in bottom edge; it sinks on press like a physical key. */
export function Button({
  label, onPress, variant = 'primary', disabled, loading, style, accessibilityHint, compact,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const { theme: t, settings } = useApp();
  const [press] = useState(() => new Animated.Value(0));
  const to = (v: number) => {
    if (settings.reducedMotion) return press.setValue(v);
    Animated.spring(press, { toValue: v, useNativeDriver: NATIVE, speed: 40, bounciness: v ? 0 : 8 }).start();
  };
  const bg = variant === 'primary' ? t.primary : variant === 'secondary' ? t.surface : 'transparent';
  const edge = variant === 'primary' ? t.primaryDeep : variant === 'secondary' ? t.tileEdge : 'transparent';
  const fg = variant === 'primary' ? t.primaryInk : variant === 'ghost' ? t.primary : t.ink;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={off}
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={[off && { opacity: 0.4 }, style]}
    >
      <Animated.View
        style={[
          styles.btn,
          compact && styles.btnCompact,
          {
            backgroundColor: bg,
            borderColor: variant === 'secondary' ? t.tileBorder : 'transparent',
            borderBottomColor: edge,
            borderBottomWidth: variant === 'ghost' ? 0 : 4,
            transform: [
              { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) },
            ],
          },
        ]}
      >
        {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, compact && styles.btnTextCompact, { color: fg }]}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

/** Fades and lifts children into place once on mount; instant under reduced motion. */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { settings } = useApp();
  const [v] = useState(() => new Animated.Value(settings.reducedMotion ? 1 : 0));
  useEffect(() => {
    if (settings.reducedMotion) return;
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Springs content from small to full size whenever `trigger` changes (e.g. a freshly collected tile). */
export function PopIn({ children, trigger, style }: { children: React.ReactNode; trigger: unknown; style?: StyleProp<ViewStyle> }) {
  const { settings } = useApp();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (settings.reducedMotion || !trigger) return;
    v.setValue(0.55);
    Animated.spring(v, { toValue: 1, useNativeDriver: NATIVE, speed: 14, bounciness: 12 }).start();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** Original mark: a lit ball falling through the dotted line onto a felt square holding an ivory letter ball. */
export function Logo({ size = 72 }: { size?: number }) {
  const { theme: t } = useApp();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityLabel="Letterdrop logo">
      <Defs>
        <LinearGradient id="lgFelt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.boardBg} />
          <Stop offset="1" stopColor={t.boardDeep} />
        </LinearGradient>
        <RadialGradient id="lgIvory" cx="38%" cy="32%" r="68%" fx="34%" fy="28%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.4" stopColor={t.pegCollected} />
          <Stop offset="1" stopColor="#9C6A14" />
        </RadialGradient>
        <RadialGradient id="lgBall" cx="38%" cy="32%" r="68%" fx="34%" fy="28%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.35" stopColor={t.ball.normal} />
          <Stop offset="1" stopColor="#8E2414" />
        </RadialGradient>
      </Defs>
      <Rect x={4} y={4} width={64} height={64} rx={16} fill="url(#lgFelt)" />
      <Rect x={4.75} y={4.75} width={62.5} height={62.5} rx={15.25} fill="none" stroke={t.bumper} strokeWidth={1.5} opacity={0.8} />
      <Line x1={12} y1={27} x2={60} y2={27} stroke={t.feltLine} strokeWidth={2} strokeDasharray="1.5 6" strokeLinecap="round" />
      <Circle cx={39} cy={50} r={13} fill="#000000" opacity={0.3} />
      <Circle cx={37} cy={48} r={13} fill="url(#lgIvory)" />
      <SvgText x={37} y={54} fontSize={17} fontWeight="800" fill={t.pegCollectedInk} textAnchor="middle">L</SvgText>
      <Circle cx={37} cy={16} r={6} fill="url(#lgBall)" />
    </Svg>
  );
}

export function Title({ size = 40 }: { size?: number }) {
  const { theme: t } = useApp();
  return (
    <Text accessibilityRole="header" style={{ fontFamily: TITLE_FONT, fontWeight: '700', fontSize: size, color: t.ink, letterSpacing: -0.8 }}>
      Letter<Text style={{ color: t.primary, fontStyle: 'italic' }}>drop</Text>
    </Text>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme: t } = useApp();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: t.bg }]} edges={['top', 'bottom', 'left', 'right']}>
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: t.accent, opacity: t.dark ? 0.06 : 0.14 }]} />
      <View style={[{ flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' }, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const { theme: t } = useApp();
  return (
    <View style={styles.topbar}>
      <View style={styles.topSide}>
        {onBack && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={[styles.iconBtn, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={{ fontSize: 26, color: t.ink, lineHeight: 28, marginTop: -2 }}>‹</Text>
          </Pressable>
        )}
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: TITLE_FONT, fontSize: 22, fontWeight: '700', color: t.ink, letterSpacing: -0.4 }}>{title}</Text>
      <View style={[styles.topSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** Letterpress tile: cream face on a darker bottom edge; filled tiles take the collected amber. */
export function LetterTile({ letter, value, size = 40, filled, color }: { letter: string; value?: number; size?: number; filled?: boolean; color?: string }) {
  const { theme: t } = useApp();
  const bg = filled ? color ?? t.pegCollected : t.tile;
  const ink = filled ? (color ? '#FFFFFF' : t.pegCollectedInk) : t.ink;
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.2, borderWidth: 1, borderBottomWidth: 3,
      borderColor: filled ? 'rgba(0,0,0,0.12)' : t.tileBorder, borderBottomColor: filled ? 'rgba(0,0,0,0.28)' : t.tileEdge,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.48, fontWeight: '800', color: ink }}>{letter}</Text>
      {value !== undefined && (
        <Text style={{ position: 'absolute', right: 3, bottom: 1, fontSize: size * 0.22, fontWeight: '700', color: ink, opacity: 0.75 }}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  btnCompact: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22 },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  btnTextCompact: { fontSize: 15 },
  glow: { position: 'absolute', top: -180, alignSelf: 'center', width: 520, height: 360, borderRadius: 260 },
  topbar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  topSide: { width: 96, flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});