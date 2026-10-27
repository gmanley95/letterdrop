import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Board, type Aim } from '../components/Board';
import { EnergyControl } from '../components/EnergyControl';
import { landedCount, refillDuration } from '../components/refillMotion';
import { Button, PopIn, Screen, TopBar } from '../components/ui';
import { BALL_CONFIGS, BALL_TYPES, type BallType } from '../engine/ballConfig';
import { isWord } from '../engine/dictionary';
import { BLANK, letterValue } from '../engine/letters';
import { BOARD, previewThroughBounces } from '../engine/physics';
import { summarize } from '../engine/results';
import {
  applyDrop, destroyRack, possibleWords, suggestWord, previewShot, skipWord, submitWord, type Refill, type Selection, type Session,
} from '../engine/session';
import { scoreWord } from '../engine/scoring';
import type { SimResult } from '../engine/physics';
import { useApp } from '../state/AppContext';
import { storage } from '../storage';

const DEFAULT_AIM: Aim = { x: BOARD.W / 2, y: BOARD.launchY, angle: Math.PI / 2, force: 'M', type: 'normal' };
const SHORT_PREVIEW_FRAMES = 22;
const PRECISION_PREVIEW_BOUNCES = 3;
const PRECISION_LOCK = 'Precision always launches at Medium force.';

/** Precision is locked to medium force; every aim change goes through here. */
function normalizeAim(a: Aim): Aim {
  return a.type === 'precision' && a.force !== 'M' ? { ...a, force: 'M' } : a;
}

interface Anim { sim: SimResult; next: Session; start: number }
interface RefillAnim { next: Session; refills: Refill[]; start: number }

export function GameScreen({ initial, onExit, onFinish }: { initial: Session; onExit: () => void; onFinish: (s: Session) => void }) {
  const { theme: t, settings, haptic, recordFinished } = useApp();
  const [session, setSession] = useState<Session>(initial);
  const [aim, setAim] = useState<Aim>(DEFAULT_AIM);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [frame, setFrame] = useState(0);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' | 'good' } | null>(null);
  const [refill, setRefill] = useState<RefillAnim | null>(null);
  const [refillT, setRefillT] = useState(0);
  /** Player-chosen display order of rack tile ids (Shuffle); null keeps collection order. */
  const [order, setOrder] = useState<string[] | null>(null);
  const litCount = useRef(0);
  const landed = useRef(0);
  /** Set synchronously on submit/skip so a double tap can't act twice before state updates. */
  const busy = useRef(false);
  const pendingRefill = useRef<Session | null>(null);

  const persist = useCallback((s: Session) => {
    if (s.mode === 'daily') storage.saveDaily(s);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onExit(); return true; });
    return () => sub.remove();
  }, [onExit]);

  const finish = useCallback((s: Session) => {
    recordFinished(s);
    onFinish(s);
  }, [onFinish, recordFinished]);

  const commitTurn = useCallback((next: Session) => {
    pendingRefill.current = null;
    busy.current = false;
    setRefill(null);
    setSession(next);
    persist(next);
    if (next.phase === 'done') finish(next);
  }, [persist, finish]);

  // Refill animation: queued letters tumble into the consumed peg slots, then the turn commits.
  useEffect(() => {
    if (!refill) return;
    let raf = 0;
    const total = refillDuration(refill.refills.length);
    const tick = () => {
      const elapsed = Date.now() - refill.start;
      const n = landedCount(refill.refills.length, elapsed);
      if (n > landed.current) { landed.current = n; haptic('light'); }
      if (elapsed >= total) { commitTurn(refill.next); return; }
      setRefillT(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [refill, commitTurn, haptic]);

  // Leaving mid-refill still saves the submitted word.
  useEffect(() => () => { if (pendingRefill.current) persist(pendingRefill.current); }, [persist]);

  // Drop animation (fixed 60 fps playback of a precomputed deterministic simulation).
  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    const speed = settings.reducedMotion ? 4 : 1;
    const tick = () => {
      const idx = Math.floor(((Date.now() - anim.start) / (1000 / 60)) * speed);
      const newLit = anim.sim.hits.filter((h) => h.frame <= idx).length;
      if (newLit > litCount.current) { litCount.current = newLit; haptic('light'); }
      if (idx >= anim.sim.frames.length - 1) {
        const next = anim.next;
        setAnim(null);
        setSession(next);
        persist(next);
        const got = anim.sim.hits.length;
        const letters = next.rack.filter((x) => next.lastCollected.includes(x.id)).map((x) => x.letter).join(' ');
        setMessage(got ? { text: `Collected ${got}: ${letters}`, tone: 'good' } : { text: 'No letters this time.', tone: 'info' });
        return;
      }
      setFrame(idx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, settings.reducedMotion, haptic, persist]);

  const lit = useMemo(() => new Set(anim ? anim.sim.hits.filter((h) => h.frame <= frame).map((h) => h.pegIndex) : []), [anim, frame]);

  const preview = useMemo(() => {
    if (session.phase !== 'aim' || anim) return [];
    const sim = previewShot(session, aim);
    if (aim.type === 'precision') return previewThroughBounces(sim, PRECISION_PREVIEW_BOUNCES, BOARD.H / 2);
    const full = BALL_CONFIGS[aim.type].fullPreview || settings.aimAssist;
    return full ? sim.frames : sim.frames.slice(0, SHORT_PREVIEW_FRAMES);
  }, [session, aim, anim, settings.aimAssist]);

  const words = useMemo(() => (session.phase === 'build' ? possibleWords(session) : []), [session]);
  const noWords = session.phase === 'build' && words.length === 0;

  const drop = () => {
    if (session.phase !== 'aim' || anim || refill) return;
    const { session: next, sim } = applyDrop(session, aim);
    litCount.current = 0;
    setMessage(null);
    setSelection([]);
    setOrder(null);
    setFrame(0);
    setAnim({ sim, next, start: Date.now() });
  };

  const patchAim = useCallback((p: Partial<Aim>) => setAim((a) => normalizeAim({ ...a, ...p })), []);

  const cycleType = () => {
    const i = BALL_TYPES.indexOf(aim.type);
    patchAim({ type: BALL_TYPES[(i + 1) % BALL_TYPES.length] });
  };

  const toggleTile = (id: string, letter: string) => {
    if (session.phase !== 'build' || refill) return;
    if (selection.some((s) => s.tileId === id)) {
      setSelection((sel) => sel.filter((s) => s.tileId !== id));
      return;
    }
    if (letter === BLANK) { setPickerFor(id); return; }
    setSelection((sel) => [...sel, { tileId: id }]);
  };

  const chooseBlank = (l: string) => {
    if (!pickerFor) return;
    const id = pickerFor;
    setSelection((sel) => [...sel, { tileId: id, as: l }]);
    setPickerFor(null);
  };

  const selectedLetters = selection.map((s) => {
    const tile = session.rack.find((x) => x.id === s.tileId)!;
    return tile.letter === BLANK ? { letter: s.as ?? '?', blank: true } : { letter: tile.letter, blank: false };
  });
  const draftScore = scoreWord(selectedLetters);
  const draftWord = selectedLetters.map((l) => l.letter).join('');
  const needMore = session.rules.minWordLength - selectedLetters.length;
  const draftValid = needMore <= 0 && isWord(draftWord);
  const check = selection.length === 0 ? null
    : needMore > 0 ? { text: `${needMore} more`, color: t.muted }
    : draftValid ? { text: '✓ Word', color: t.success }
    : { text: '✗ Not a word', color: t.danger };

  const removeAt = (i: number) => {
    if (refill || anim) return;
    setSelection((sel) => sel.filter((_, k) => k !== i));
  };

  const shuffle = () => {
    if (refill || anim) return;
    const ids = session.rack.map((x) => x.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setOrder(ids);
    haptic('light');
  };

  const suggestion = useMemo(() => (session.phase === 'build' ? suggestWord(session) : null), [session]);

  const suggest = () => {
    if (!suggestion || refill || anim) return;
    setPickerFor(null);
    setSelection(suggestion.selection);
    setMessage({ text: `Suggested ${suggestion.word} (${suggestion.score} pt). A middle pick, so there may be better.`, tone: 'info' });
  };

  const submit = () => {
    if (busy.current || refill || anim) return;
    const res = submitWord(session, selection);
    if (!res.ok) {
      setMessage({ text: res.error, tone: 'error' });
      haptic('error');
      return;
    }
    haptic('success');
    setSelection([]);
    setPickerFor(null);
    setMessage({ text: `${res.word.word} +${res.word.score}`, tone: 'good' });
    startRefill(res.session, res.refills);
  };

  const startRefill = (next: Session, refills: Refill[]) => {
    if (settings.reducedMotion || refills.length === 0) {
      commitTurn(next);
      return;
    }
    busy.current = true;
    pendingRefill.current = next;
    landed.current = 0;
    setRefillT(0);
    setRefill({ next, refills, start: Date.now() });
  };

  const skip = () => {
    if (busy.current || refill || anim) return;
    setSelection([]);
    setPickerFor(null);
    if (noWords) {
      // No word possible: the collected letters are destroyed and replaced from the tray.
      const res = destroyRack(session);
      setMessage(session.rack.length ? { text: `${session.rack.length} letter${session.rack.length === 1 ? '' : 's'} destroyed`, tone: 'error' } : null);
      haptic('error');
      startRefill(res.session, res.refills);
      return;
    }
    setMessage(null);
    commitTurn(skipWord(session));
  };

  /** During a refill the board keeps the old layout, but rack and counters already reflect the played word. */
  const view = refill ? refill.next : session;
  const r = summarize(view);
  const rackShown = order
    ? [...order.map((id) => view.rack.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x), ...view.rack.filter((x) => !order.includes(x.id))]
    : view.rack;
  const dropsLeft = view.rules.drops - view.dropsUsed;
  const refilling = refill !== null;

  return (
    <Screen>
      <TopBar
        title="Letterdrop"
        onBack={onExit}
        right={<Text style={{ color: t.pegCollectedInk, backgroundColor: t.accent, overflow: 'hidden', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800', fontSize: 15, marginRight: 4 }} accessibilityLabel={`Top three score ${r.shareScore}`}>⭐ {r.shareScore}</Text>}
      />
      <View style={styles.status}>
        <View style={styles.dots} accessibilityLabel={`${dropsLeft} of ${session.rules.drops} drops left`}>
          {Array.from({ length: view.rules.drops }, (_, i) => (
            <View key={i} style={[styles.dot, { borderColor: i < view.dropsUsed ? t.tileBorder : t.primaryDeep, backgroundColor: i < view.dropsUsed ? 'transparent' : t.primary }]} />
          ))}
          <Text style={[styles.statusText, { color: t.muted }]}>{dropsLeft} {dropsLeft === 1 ? 'drop' : 'drops'} left</Text>
        </View>
        <Text style={[styles.statusText, { color: t.muted }]}>{view.words.length}/{view.rules.maxWords} words · tray {view.queue.length}</Text>
      </View>

      <Board
        layout={session.layout}
        pegs={refill ? refill.next.pegs : session.pegs}
        queue={session.queue}
        visibleQueue={session.rules.visibleQueue}
        aim={aim}
        showAim={session.phase === 'aim' && !anim}
        ball={anim ? anim.sim.frames[Math.min(frame, anim.sim.frames.length - 1)] : session.phase === 'aim' ? null : { x: -50, y: -50 }}
        preview={preview}
        lit={lit}
        interactive={session.phase === 'aim' && !anim}
        refill={refill ? { refills: refill.refills, elapsed: refillT } : null}
        onAim={patchAim}
        onTapBall={cycleType}
        trail={anim ? anim.sim.frames.slice(Math.max(0, Math.min(frame, anim.sim.frames.length - 1) - 9), Math.min(frame, anim.sim.frames.length - 1)) : undefined}
      />

      <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: message?.tone === 'error' ? t.danger : message?.tone === 'good' ? t.success : t.muted }]}
          numberOfLines={2}
        >
          {message?.text ??
            (anim ? 'Dropping…' : session.phase === 'aim'
              ? 'Drag the dotted launch zone to place the ball. Drag below it to aim. Tap the ball to switch.'
              : noWords ? '' : `Build a word: ${words.length > 99 ? '99+' : words.length} possible.`)}
        </Text>

        {/* Rack */}
        <View style={styles.rack} accessibilityLabel="Your letters">
          {Array.from({ length: view.rules.rackCapacity }, (_, i) => {
            const tile = rackShown[i];
            if (!tile) return <View key={`e${i}`} style={[styles.tileWrap, styles.tile, { borderColor: t.tileBorder, borderStyle: 'dashed', borderBottomWidth: 1.5 }]} />;
            const sel = selection.find((s) => s.tileId === tile.id);
            const fresh = view.lastCollected.includes(tile.id);
            const shown = tile.letter === BLANK && sel?.as ? sel.as : tile.letter;
            return (
              <PopIn key={tile.id} trigger={fresh ? tile.id : 0} style={styles.tileWrap}>
              <Pressable
                onPress={() => toggleTile(tile.id, tile.letter)}
                disabled={session.phase !== 'build' || refilling}
                accessibilityRole="button"
                accessibilityLabel={`${tile.letter === BLANK ? 'Blank tile' : tile.letter}${sel ? ', selected' : ''}`}
                style={[
                  styles.tile,
                  {
                    borderColor: sel ? t.tileSelected : fresh ? t.pegCollected : t.tileBorder,
                    borderBottomColor: sel ? t.tileSelected : fresh ? '#9C6A14' : t.tileEdge,
                    backgroundColor: sel ? t.tileSelected : fresh ? t.pegCollected : t.tile,
                    transform: [{ translateY: sel ? 2 : 0 }],
                  },
                ]}
              >
                <Text style={[styles.tileText, { color: sel ? t.tileSelectedInk : fresh ? t.pegCollectedInk : t.ink }]}>{shown}</Text>
                <Text style={[styles.tileVal, { color: sel ? t.tileSelectedInk : fresh ? t.pegCollectedInk : t.muted }]}>{tile.letter === BLANK ? 0 : letterValue(tile.letter)}</Text>
              </Pressable>
              </PopIn>
            );
          })}
        </View>

        {session.phase === 'aim' && !anim && (
          <View>
            <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Ball type">
              {BALL_TYPES.map((bt) => <BallChip key={bt} type={bt} active={aim.type === bt} onPress={() => patchAim({ type: bt })} />)}
            </View>
            <View style={[styles.row, { marginTop: 8 }]}>
              <EnergyControl
                value={aim.force}
                onChange={(force) => patchAim({ force })}
                lockReason={aim.type === 'precision' ? PRECISION_LOCK : null}
              />
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Button compact variant="secondary" label="Reset aim" onPress={() => setAim((a) => normalizeAim({ ...DEFAULT_AIM, type: a.type }))} style={{ flex: 1 }} />
              <Button compact label={`Drop ${BALL_CONFIGS[aim.type].label}`} onPress={drop} style={{ flex: 1.6 }} />
            </View>
          </View>
        )}

        {session.phase === 'build' && !anim && (
          <View>
            {noWords ? (
              <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.danger }]} accessibilityLiveRegion="assertive">
                <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>No words can be formed</Text>
                <Text style={{ color: t.muted, marginTop: 2 }}>
                  {session.rack.length < session.rules.minWordLength
                    ? `You need at least ${session.rules.minWordLength} letters. They are destroyed and replaced from the tray. This drop still counts.`
                    : 'No word in the list fits these letters. They are destroyed and replaced from the tray. This drop still counts.'}
                </Text>
              </View>
            ) : (
              <View
                style={[styles.wordRow, { borderColor: check ? check.color : t.line }]}
                accessibilityLabel={`Current word ${draftWord}, ${draftScore} points${check ? `, ${check.text.replace(/[✓✗] /, '')}` : ''}`}
              >
                <ScrollView horizontal contentContainerStyle={{ gap: 4, alignItems: 'center' }} style={{ flex: 1 }}>
                  {selectedLetters.length === 0 && <Text style={{ color: t.muted }}>Tap letters to spell a word</Text>}
                  {selectedLetters.map((l, i) => (
                    <Pressable
                      key={i}
                      onPress={() => removeAt(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${l.letter}`}
                      hitSlop={{ top: 5, bottom: 5 }}
                      style={({ pressed }) => [styles.wordTile, { backgroundColor: pressed ? t.line : t.tile, borderColor: t.tileBorder, borderBottomColor: t.tileEdge, borderStyle: l.blank ? 'dashed' : 'solid' }]}
                    >
                      <Text style={{ fontWeight: '800', fontSize: 18, color: t.ink }}>{l.letter}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                  <Text style={{ fontWeight: '800', fontSize: 18, color: t.primary }}>{draftScore} pt</Text>
                  {check && <Text style={{ fontWeight: '800', fontSize: 11, color: check.color }}>{check.text}</Text>}
                </View>
                <Pressable
                  onPress={shuffle}
                  disabled={refilling || view.rack.length < 2}
                  accessibilityRole="button"
                  accessibilityLabel="Shuffle letters"
                  style={({ pressed }) => [styles.shuffle, { backgroundColor: pressed ? t.line : t.bg, borderColor: t.tileBorder, opacity: refilling || view.rack.length < 2 ? 0.4 : 1 }]}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800', color: t.ink }}>⇄</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.row, { marginTop: 10 }]}>
              {!noWords && <Button compact variant="ghost" label="Clear" onPress={() => setSelection([])} disabled={!selection.length || refilling} />}
              {!noWords && <Button compact variant="ghost" label="Suggest" onPress={suggest} disabled={!suggestion || refilling} accessibilityHint="Fills in a middle-scoring word, not the best one" />}
              <Button
                compact
                variant={noWords ? 'primary' : 'secondary'}
                label={noWords ? (dropsLeft > 0 ? 'Destroy & next drop' : 'Destroy & finish') : dropsLeft > 0 ? 'Skip word' : 'Finish'}
                onPress={skip}
                disabled={refilling}
                style={{ flex: 1 }}
              />
              {!noWords && <Button compact label={refilling ? 'Refilling…' : 'Submit'} onPress={submit} disabled={refilling || selection.length < session.rules.minWordLength} style={{ flex: 1.3 }} />}
            </View>
          </View>
        )}
      </View>

      {pickerFor && (
        <View style={[StyleSheet.absoluteFill, styles.scrim]} accessibilityViewIsModal>
          <View style={[styles.picker, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: t.ink, marginBottom: 4 }}>Choose a letter for ?</Text>
            <Text style={{ color: t.muted, marginBottom: 12 }}>Blanks score 0 points.</Text>
            <View style={styles.grid}>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
                <Pressable key={l} onPress={() => chooseBlank(l)} accessibilityRole="button" accessibilityLabel={l} style={({ pressed }) => [styles.key, { backgroundColor: pressed ? t.accent : t.tile, borderColor: t.tileBorder, borderBottomColor: t.tileEdge }]}>
                  <Text style={{ fontWeight: '800', fontSize: 17, color: t.ink }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <Button compact variant="ghost" label="Cancel" onPress={() => setPickerFor(null)} style={{ marginTop: 8 }} />
          </View>
        </View>
      )}
    </Screen>
  );
}

function BallChip({ type, active, onPress }: { type: BallType; active: boolean; onPress: () => void }) {
  const { theme: t } = useApp();
  const c = t.ball[type];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={active}
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${BALL_CONFIGS[type].label} ball. ${BALL_CONFIGS[type].short}`}
      style={[styles.chip, { borderColor: active ? c : t.line, backgroundColor: active ? t.bg : 'transparent', borderWidth: active ? 2 : 1 }]}
    >
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: type === 'pass' ? 'transparent' : c,
        borderWidth: type === 'pass' ? 2.5 : 0, borderColor: c, borderStyle: type === 'pass' ? 'dashed' : 'solid',
      }} />
      <Text style={{ fontWeight: '700', color: t.ink, fontSize: 13 }} numberOfLines={1}>{BALL_CONFIGS[type].label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  statusText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  panel: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  message: { fontSize: 13, minHeight: 18, textAlign: 'center', marginBottom: 6, fontWeight: '600' },
  rack: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 10 },
  tileWrap: { flex: 1, maxWidth: 40, aspectRatio: 1 },
  tile: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 19, fontWeight: '800' },
  tileVal: { position: 'absolute', right: 2, bottom: 0, fontSize: 9, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { flex: 1, minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  wordRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8, borderWidth: 1.5, borderRadius: 14, paddingLeft: 8, paddingRight: 4 },
  shuffle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wordTile: { width: 34, height: 34, borderRadius: 7, borderWidth: 1.5, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 12, borderRadius: 14, borderLeftWidth: 4 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  picker: { width: '100%', maxWidth: 380, borderRadius: 22, padding: 18, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  key: { width: 42, height: 46, borderRadius: 9, borderWidth: 1, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
