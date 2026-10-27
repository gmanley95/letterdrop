import React, { useRef, useState } from 'react';
import {
  Pressable, StyleSheet, Text, View, type GestureResponderEvent, type GestureResponderHandlers, type LayoutChangeEvent,
} from 'react-native';
import { FORCES, FORCE_LABEL, type Force } from '../engine/ballConfig';
import { useApp } from '../state/AppContext';

interface Props {
  value: Force;
  onChange: (f: Force) => void;
  /** When set, only `value` can be chosen and this reason is shown. */
  lockReason?: string | null;
  disabled?: boolean;
}

function forceAt(x: number, width: number): Force {
  const i = Math.max(0, Math.min(FORCES.length - 1, Math.floor((x / Math.max(1, width)) * FORCES.length)));
  return FORCES[i];
}

/** Segmented S/M/L energy picker: tap a choice, or drag the highlight across the track. */
export function EnergyControl({ value, onChange, lockReason, disabled }: Props) {
  const { theme: t } = useApp();
  const [width, setWidth] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null);
  const trackRef = useRef<React.ComponentRef<typeof View>>(null);
  const originX = useRef(0);
  const locked = !!lockReason;

  const dragTo = (pageX: number) => {
    const x = Math.max(0, Math.min(width, pageX - originX.current));
    setDragX(x);
    const f = forceAt(x, width);
    if (f !== value) onChange(f);
  };

  // Capture the pointer from the start so mouse and touch drags cannot become segment taps.
  const responder: GestureResponderHandlers = {
    onStartShouldSetResponderCapture: () => !locked && !disabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      trackRef.current?.measureInWindow((x) => { originX.current = x; });
      dragTo(e.nativeEvent.pageX);
    },
    onResponderMove: (e: GestureResponderEvent) => dragTo(e.nativeEvent.pageX),
    onResponderRelease: () => setDragX(null),
    onResponderTerminate: () => setDragX(null),
  };

  const segW = width / FORCES.length;
  const pillLeft = dragX !== null
    ? Math.max(0, Math.min(width - segW, dragX - segW / 2))
    : FORCES.indexOf(value) * segW;

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    requestAnimationFrame(() => trackRef.current?.measureInWindow((x) => { originX.current = x; }));
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        ref={trackRef}
        onLayout={onLayout}
        {...responder}
        style={[styles.track, { borderColor: t.tileBorder, backgroundColor: t.bg, opacity: disabled ? 0.38 : 1 }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={locked ? `Force, locked. ${lockReason}` : 'Force. Tap a size or drag across.'}
      >
        {width > 0 && (
          <View
            pointerEvents="none"
            style={[styles.pill, { width: segW, left: pillLeft, backgroundColor: t.primary, borderBottomWidth: 3, borderBottomColor: t.primaryDeep }]}
          />
        )}
        {FORCES.map((f) => {
          const active = value === f;
          const off = disabled || (locked && !active);
          return (
            <Pressable
              key={f}
              accessibilityRole="radio"
              aria-checked={active}
              accessibilityState={{ checked: active, disabled: off }}
              accessibilityLabel={`${FORCE_LABEL[f]} force`}
              accessibilityHint={locked && !active ? lockReason ?? undefined : undefined}
              disabled={off}
              onPress={() => onChange(f)}
              style={styles.seg}
            >
              <View style={styles.bars}>
                {[0, 1, 2].map((b) => (
                  <View
                    key={b}
                    style={{ width: 4, height: 6 + b * 4, backgroundColor: active ? t.primaryInk : t.ink, opacity: b <= FORCES.indexOf(f) ? 1 : 0.25 }}
                  />
                ))}
              </View>
              <Text style={{ fontWeight: '700', color: active ? t.primaryInk : t.ink, opacity: locked && !active ? 0.4 : 1 }}>{FORCE_LABEL[f]}</Text>
            </Pressable>
          );
        })}
      </View>
      {locked && (
        <Text style={[styles.lock, { color: t.muted }]} accessibilityElementsHidden importantForAccessibility="no">
          {lockReason}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 22, overflow: 'hidden' },
  pill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 20 },
  seg: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginRight: 6 },
  lock: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
