import type { Refill } from '../engine/session';

export const REFILL_STAGGER = 110;
export const REFILL_FLIGHT = 560;
export const REFILL_SETTLE = 160;
export const QUEUE_SHIFT = 380;

export const TRAY_Y = 22;
export const TRAY_R = 12.5;

/** Refills in launch order (front of the tray first). */
export function orderRefills(refills: Refill[]): Refill[] {
  return [...refills].sort((a, b) => a.queueIndex - b.queueIndex);
}

export function refillDuration(count: number): number {
  return count === 0 ? 0 : (count - 1) * REFILL_STAGGER + REFILL_FLIGHT + REFILL_SETTLE;
}

/** Number of letters that have landed after `elapsed` ms. */
export function landedCount(count: number, elapsed: number): number {
  let n = 0;
  for (let k = 0; k < count; k++) if (elapsed - k * REFILL_STAGGER >= REFILL_FLIGHT) n++;
  return n;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Progress (0..1) of the remaining tray balls sliding into their new slots. */
export function queueShift(count: number, elapsed: number): number {
  const start = Math.max(0, ((count - 1) * REFILL_STAGGER) / 2) + 90;
  return easeInOutSine(clamp01((elapsed - start) / QUEUE_SHIFT));
}

export interface FlightPose { x: number; y: number; r: number; rotation: number; scale: number; t: number }

/** Pose of the k-th refill letter tumbling from its tray slot to its peg. */
export function flightPose(
  k: number,
  elapsed: number,
  from: { x: number; y: number },
  to: { x: number; y: number; r: number },
): FlightPose {
  const local = elapsed - k * REFILL_STAGGER;
  const t = clamp01(local / REFILL_FLIGHT);
  const dir = to.x >= from.x ? 1 : -1;
  const x = from.x + (to.x - from.x) * easeInOutSine(t);
  // Gravity-like fall with a small hop out of the tray.
  const y = from.y + (to.y - from.y) * t * t - 16 * Math.sin(Math.PI * t) * (1 - t);
  const r = TRAY_R + (to.r - TRAY_R) * easeOutCubic(t);
  const s = clamp01((local - REFILL_FLIGHT) / REFILL_SETTLE);
  const scale = local >= REFILL_FLIGHT && s < 1 ? 1 + 0.12 * Math.sin(Math.PI * s) : 1;
  return { x, y, r, rotation: (dir * 360 * easeOutCubic(t)) % 360, scale, t };
}