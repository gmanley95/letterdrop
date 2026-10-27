import React, { useMemo, useRef, useState } from 'react';
import { View, type GestureResponderEvent, type GestureResponderHandlers, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { BALL_CONFIGS, type BallType, type Force } from '../engine/ballConfig';
import { BLANK, letterValue } from '../engine/letters';
import { BOARD, MAX_ANGLE, MIN_ANGLE, clampAngle, clampLaunchX, clampLaunchY } from '../engine/physics';
import type { PegState, Refill } from '../engine/session';
import type { BoardLayout } from '../engine/board';
import { useApp } from '../state/AppContext';
import { TRAY_R, TRAY_Y, flightPose, orderRefills, queueShift } from './refillMotion';

export interface Aim { x: number; y: number; angle: number; force: Force; type: BallType }

const BALL_EDGE: Record<BallType, string> = { normal: '#8E2414', precision: '#163C8C', pass: '#4A2A8A' };
const ARROW_LEN: Record<Force, number> = { S: 46, M: 76, L: 106 };
/** Touches this close to the ball grab it (keeping the offset) or, without moving, switch its type. */
const GRAB_R = 26;

export function forceFromDistance(d: number): Force {
  if (d < 120) return 'S';
  if (d < 210) return 'M';
  return 'L';
}

export interface RefillView {
  refills: Refill[];
  /** Milliseconds since the refill animation started. */
  elapsed: number;
}

interface Props {
  layout: BoardLayout;
  pegs: PegState[];
  queue: string[];
  visibleQueue: number;
  aim: Aim;
  showAim: boolean;
  ball: { x: number; y: number } | null;
  preview: { x: number; y: number }[];
  /** Pegs lit during the current drop animation. */
  lit: Set<number>;
  interactive: boolean;
  /** Queued letters tumbling into consumed slots; `queue` is the tray before the refill. */
  refill?: RefillView | null;
  onAim: (patch: Partial<Aim>) => void;
  onTapBall: () => void;
  /** Recent ball positions, oldest first, drawn as a fading trail. */
  trail?: { x: number; y: number }[];
}

export function Board({ layout, pegs, queue, visibleQueue, aim, showAim, ball, preview, lit, interactive, refill, onAim, onTapBall, trail }: Props) {
  const { theme: t } = useApp();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<React.ComponentRef<typeof View>>(null);
  const scale = size.w && size.h ? Math.min(size.w / BOARD.W, size.h / BOARD.H) : 0;
  const drawW = BOARD.W * scale;
  const drawH = BOARD.H * scale;

  const gesture = useRef({ mode: 'none' as 'none' | 'move' | 'aim', startX: 0, startY: 0, moved: false, offX: 0, offY: 0 });

  const toBoard = (pageX: number, pageY: number) => {
    const offX = (size.w - drawW) / 2;
    const offY = (size.h - drawH) / 2;
    return { x: (pageX - origin.current.x - offX) / scale, y: (pageY - origin.current.y - offY) / scale };
  };

  const applyAim = (p: { x: number; y: number }) => {
    const dx = p.x - aim.x;
    const dy = p.y - aim.y;
    if (dy < 4) return;
    onAim({ angle: clampAngle(Math.atan2(dy, dx)), force: forceFromDistance(Math.hypot(dx, dy)) });
  };

  const moveBall = (p: { x: number; y: number }) => {
    const g = gesture.current;
    onAim({ x: clampLaunchX(p.x + g.offX), y: clampLaunchY(p.y + g.offY) });
  };

  // Plain responder props (recreated each render) so handlers always see the current aim.
  const responder: GestureResponderHandlers = {
    onStartShouldSetResponder: () => interactive && scale > 0,
    onMoveShouldSetResponder: () => interactive && scale > 0,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      viewRef.current?.measureInWindow((x, y) => { origin.current = { x, y }; });
      const p = toBoard(e.nativeEvent.pageX, e.nativeEvent.pageY);
      const onBall = Math.hypot(p.x - aim.x, p.y - aim.y) < GRAB_R;
      // Launch zone (between tray and line) moves the ball; below the line aims. The tray is inert.
      const mode = onBall || (p.y >= BOARD.trayBottom && p.y < BOARD.lineY) ? 'move' : p.y >= BOARD.lineY ? 'aim' : 'none';
      gesture.current = {
        mode,
        startX: e.nativeEvent.pageX,
        startY: e.nativeEvent.pageY,
        moved: false,
        offX: onBall ? aim.x - p.x : 0,
        offY: onBall ? aim.y - p.y : 0,
      };
      if (mode === 'aim') applyAim(p);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (Math.hypot(e.nativeEvent.pageX - g.startX, e.nativeEvent.pageY - g.startY) > 6) g.moved = true;
      const p = toBoard(e.nativeEvent.pageX, e.nativeEvent.pageY);
      if (g.mode === 'move' && g.moved) moveBall(p);
      else if (g.mode === 'aim') applyAim(p);
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (g.mode === 'move' && !g.moved) {
        const p = toBoard(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (Math.hypot(p.x - aim.x, p.y - aim.y) < GRAB_R) onTapBall();
        else moveBall(p);
      }
      g.mode = 'none';
    },
    onResponderTerminate: () => { gesture.current.mode = 'none'; },
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    requestAnimationFrame(() => viewRef.current?.measureInWindow((x, y) => { origin.current = { x, y }; }));
  };

  const ballColor = t.ball[aim.type];
  const ballPos = ball ?? { x: aim.x, y: aim.y };
  const len = ARROW_LEN[aim.force];
  const ax = aim.x + Math.cos(aim.angle) * len;
  const ay = aim.y + Math.sin(aim.angle) * len;
  const head = (() => {
    const a = aim.angle;
    const s = 9;
    return `${ax + Math.cos(a) * s},${ay + Math.sin(a) * s} ${ax + Math.cos(a + 2.4) * s},${ay + Math.sin(a + 2.4) * s} ${ax + Math.cos(a - 2.4) * s},${ay + Math.sin(a - 2.4) * s}`;
  })();
  const previewPath = preview.length > 1 ? `M${preview.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}` : '';
  const trayStep = BOARD.W / visibleQueue;
  const slotX = (i: number) => trayStep * i + trayStep / 2;

  // Refill choreography: which tray slots are in flight, where the rest slide to, which pegs await a letter.
  const fx = useMemo(() => {
    if (!refill) return null;
    const ordered = orderRefills(refill.refills);
    const flying = new Set(ordered.map((r) => r.queueIndex));
    const targets = new Set(ordered.map((r) => r.pegIndex));
    const shift = queueShift(ordered.length, refill.elapsed);
    const remaining = queue
      .map((letter, i) => ({ letter, i, ni: i - ordered.filter((r) => r.queueIndex < i).length }))
      .filter((q) => !flying.has(q.i))
      .map((q) => ({ ...q, idx: q.i + (q.ni - q.i) * shift }))
      .filter((q) => q.idx < visibleQueue + 0.999);
    const flights = ordered.map((r, k) => {
      const peg = layout.pegs[r.pegIndex];
      return { r, pose: flightPose(k, refill.elapsed, { x: slotX(r.queueIndex), y: TRAY_Y }, peg) };
    });
    return { targets, remaining, flights };
  }, [refill, queue, layout, visibleQueue, trayStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const trayItems = fx
    ? fx.remaining.map((q) => ({ key: `q${q.i}`, letter: q.letter, idx: q.idx }))
    : queue.slice(0, visibleQueue).map((letter, i) => ({ key: `q${i}`, letter, idx: i }));
  const trayEmpty = fx ? fx.remaining.length === 0 && fx.flights.every((f) => f.pose.t > 0) : queue.length === 0;

  const label = `Board with ${pegs.filter((p) => p.letter && !p.collected).length} letters available. ${BALL_CONFIGS[aim.type].label} ball, ${aim.force === 'S' ? 'small' : aim.force === 'M' ? 'medium' : 'large'} force.`;

  return (
    <View ref={viewRef} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onLayout={onLayout} {...responder} accessible accessibilityLabel={label}>
      {scale > 0 && (
        <Svg width={drawW} height={drawH} viewBox={`0 0 ${BOARD.W} ${BOARD.H}`}>
          <Defs>
            <LinearGradient id="felt" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.boardBg} />
              <Stop offset="1" stopColor={t.boardDeep} />
            </LinearGradient>
            <RadialGradient id="vignette" cx="50%" cy="45%" r="70%">
              <Stop offset="0.6" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.32} />
            </RadialGradient>
            <Sphere id="gPeg" hi="#FFFFFF" base={t.peg} edge={t.pegShade} />
            <Sphere id="gCollected" hi="#FFF1C9" base={t.pegCollected} edge="#9C6A14" />
            <Sphere id="gNew" hi="#FFFFFF" base={t.pegNew} edge="#C99A1E" />
            <Sphere id="gBrass" hi="#FFF0C8" base={t.bumper} edge={t.bumperShade} />
            {(['normal', 'precision', 'pass'] as const).map((k) => (
              <Sphere key={k} id={`gBall-${k}`} hi="#FFFFFF" base={t.ball[k]} edge={BALL_EDGE[k]} />
            ))}
          </Defs>
          <Rect x={0} y={0} width={BOARD.W} height={BOARD.H} fill="url(#felt)" />
          <Rect x={0} y={0} width={BOARD.W} height={BOARD.H} fill="url(#vignette)" />
          {/* Loading tray */}
          <Rect x={0} y={0} width={BOARD.W} height={BOARD.trayBottom} fill={t.trayBg} />
          <Line x1={0} y1={BOARD.trayBottom - 0.75} x2={BOARD.W} y2={BOARD.trayBottom - 0.75} stroke={t.bumper} strokeWidth={1.5} opacity={0.7} />
          {trayItems.map((q) => (
            <G key={q.key} opacity={Math.max(0.25, 1 - q.idx * 0.06)}>
              <Circle cx={slotX(q.idx) + 1} cy={TRAY_Y + 2} r={TRAY_R} fill="#000000" opacity={0.35} />
              <Circle cx={slotX(q.idx)} cy={TRAY_Y} r={TRAY_R} fill="url(#gPeg)" />
              {q.idx < 0.5 && <Circle cx={slotX(q.idx)} cy={TRAY_Y} r={TRAY_R + 2.5} fill="none" stroke={t.accent} strokeWidth={2} />}
              <SvgText x={slotX(q.idx)} y={TRAY_Y + 5} fontSize={14} fontWeight="800" fill={t.pegInk} textAnchor="middle">{q.letter}</SvgText>
            </G>
          ))}
          {trayEmpty && (
            <SvgText x={BOARD.W / 2} y={27} fontSize={13} fill={t.feltLine} textAnchor="middle">Tray empty</SvgText>
          )}
          {/* Launch zone */}
          <Rect x={0} y={BOARD.trayBottom} width={BOARD.W} height={BOARD.lineY - BOARD.trayBottom} fill={t.launchBg} opacity={0.85} />
          <Line x1={6} y1={BOARD.lineY} x2={BOARD.W - 6} y2={BOARD.lineY} stroke={t.feltLine} strokeWidth={2} strokeDasharray="1.5 9" strokeLinecap="round" />
          {/* Exit line: the ball's drop ends once it crosses here. */}
          <Line x1={6} y1={BOARD.exitY} x2={BOARD.W - 6} y2={BOARD.exitY} stroke={t.feltLine} strokeWidth={2} strokeDasharray="1.5 9" strokeLinecap="round" />
          {/* Walls */}
          <Line x1={1} y1={BOARD.trayBottom} x2={1} y2={BOARD.H} stroke={t.bumper} strokeWidth={2} opacity={0.8} />
          <Line x1={BOARD.W - 1} y1={BOARD.trayBottom} x2={BOARD.W - 1} y2={BOARD.H} stroke={t.bumper} strokeWidth={2} opacity={0.8} />
          {/* Bumpers */}
          {layout.bumpers.map((b, i) => (
            <G key={`b${i}`}>
              <Circle cx={b.x + 2} cy={b.y + 4} r={b.r} fill="#000000" opacity={0.3} />
              <Circle cx={b.x} cy={b.y} r={b.r} fill="url(#gBrass)" />
              <Circle cx={b.x} cy={b.y} r={b.r - 7} fill={t.boardDeep} opacity={0.22} />
              <Circle cx={b.x} cy={b.y} r={b.r - 7} fill="none" stroke="#FFF0C8" strokeWidth={1} opacity={0.5} />
            </G>
          ))}
          {/* Plain pegs (no letter) */}
          {(layout.posts ?? []).map((c, i) => (
            <G key={`s${i}`}>
              <Circle cx={c.x + 1} cy={c.y + 1.5} r={c.r} fill="#000000" opacity={0.35} />
              <Circle cx={c.x} cy={c.y} r={c.r} fill="url(#gBrass)" />
            </G>
          ))}
          {/* Letter pegs */}
          {layout.pegs.map((c, i) => {
            const p = pegs[i];
            const isLit = lit.has(i);
            const collected = p.collected || isLit;
            if (!p.letter || fx?.targets.has(i)) {
              return <Circle key={`p${i}`} cx={c.x} cy={c.y} r={c.r} fill="none" stroke={t.feltLine} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.6} />;
            }
            const fill = isLit ? 'url(#gNew)' : collected ? 'url(#gCollected)' : 'url(#gPeg)';
            const ink = collected ? t.pegCollectedInk : t.pegInk;
            return (
              <G key={`p${i}`}>
                {isLit && <Circle cx={c.x} cy={c.y} r={c.r + 6} fill={t.pegNew} opacity={0.3} />}
                <Circle cx={c.x + 1.2} cy={c.y + 2.2} r={c.r} fill="#000000" opacity={0.32} />
                <Circle cx={c.x} cy={c.y} r={c.r} fill={fill} />
                <SvgText x={c.x} y={c.y + 4.5} fontSize={13} fontWeight="800" fill={ink} textAnchor="middle">{p.letter}</SvgText>
                {p.letter !== BLANK && (
                  <SvgText x={c.x + 7.5} y={c.y + 10} fontSize={6} fontWeight="700" fill={ink} opacity={0.75} textAnchor="middle">{letterValue(p.letter)}</SvgText>
                )}
              </G>
            );
          })}
          {/* Aim */}
          {showAim && previewPath !== '' && (
            <Path d={previewPath} stroke={ballColor} strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" fill="none" opacity={0.95} />
          )}
          {showAim && (
            <G>
              {[MIN_ANGLE, MAX_ANGLE].map((a) => (
                <Line key={`cone${a}`} x1={aim.x} y1={aim.y} x2={aim.x + Math.cos(a) * 64} y2={aim.y + Math.sin(a) * 64} stroke={t.feltLine} strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
              ))}
              <Line x1={aim.x} y1={aim.y} x2={ax} y2={ay} stroke={t.feltInk} strokeWidth={3} strokeLinecap="round" />
              <Polygon points={head} fill={t.feltInk} />
            </G>
          )}
          {/* Trail */}
          {(trail ?? []).map((p, i, arr) => (
            <Circle key={`t${i}`} cx={p.x} cy={p.y} r={BOARD.ballR * (0.35 + 0.55 * (i / arr.length))} fill={ballColor} opacity={0.08 + 0.4 * (i / arr.length)} />
          ))}
          {/* Ball */}
          <Circle cx={ballPos.x + 1} cy={ballPos.y + 2} r={BOARD.ballR} fill="#000000" opacity={0.35} />
          <Circle
            cx={ballPos.x}
            cy={ballPos.y}
            r={BOARD.ballR}
            fill={aim.type === 'pass' ? t.boardDeep : `url(#gBall-${aim.type})`}
            fillOpacity={aim.type === 'pass' ? 0.6 : 1}
            stroke={aim.type === 'pass' ? ballColor : 'none'}
            strokeWidth={aim.type === 'pass' ? 3 : 0}
            strokeDasharray={aim.type === 'pass' ? '3 2.5' : undefined}
          />
          {aim.type === 'precision' && <Circle cx={ballPos.x} cy={ballPos.y} r={2} fill="#FFFFFF" />}
          {/* Refill letters tumbling from the tray */}
          {fx?.flights.map(({ r, pose }) => {
            const k = pose.r / BOARD.pegR;
            return (
              <G key={`f${r.queueIndex}`} transform={`translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.rotation.toFixed(1)}) scale(${pose.scale.toFixed(3)})`}>
                <Circle cx={1} cy={2} r={pose.r} fill="#000000" opacity={0.3} />
                <Circle cx={0} cy={0} r={pose.r} fill="url(#gPeg)" stroke={pose.t > 0 ? 'none' : t.accent} strokeWidth={2} />
                <SvgText x={0} y={4.5 * k} fontSize={13 * k} fontWeight="800" fill={t.pegInk} textAnchor="middle">{r.letter}</SvgText>
                {r.letter !== BLANK && pose.t > 0.6 && (
                  <SvgText x={7.5 * k} y={10 * k} fontSize={6 * k} fontWeight="700" fill={t.pegInk} textAnchor="middle">{letterValue(r.letter)}</SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Off-centre radial gradient that turns a flat circle into a lit sphere. */
function Sphere({ id, hi, base, edge, edgeOpacity = 1 }: { id: string; hi: string; base: string; edge: string; edgeOpacity?: number }) {
  return (
    <RadialGradient id={id} cx="38%" cy="32%" r="68%" fx="34%" fy="28%">
      <Stop offset="0" stopColor={hi} />
      <Stop offset="0.35" stopColor={base} />
      <Stop offset="1" stopColor={edge} stopOpacity={edgeOpacity} />
    </RadialGradient>
  );
}
