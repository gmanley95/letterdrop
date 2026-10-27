import { BOARD, type Circle } from './physics';
import type { Rng } from './rng';

export interface BoardLayout {
  pegs: Circle[];
  bumpers: Circle[];
  /** Small plain pegs with no letter. Every ball bounces off them, including pass-through. */
  posts?: Circle[];
}

export const POST_R = 5;
export const BUMPER_R = 32;
export const DEFAULT_POST_COUNT = 6;
/** Minimum clear space between any two obstacles (and walls), so the dropped ball always fits. */
export const MIN_GAP = 2 * BOARD.ballR + 4;

const FIELD_TOP = BOARD.lineY + 30;
const FIELD_BOTTOM = BOARD.exitY - 22;
const CANDIDATES = 12;

/** Two curved bumpers per side, at random heights in an upper and a lower band. */
function placeBumpers(rng: Rng): Circle[] {
  const bumpers: Circle[] = [];
  for (const x of [-6, BOARD.W + 6]) {
    bumpers.push({ x, y: 170 + rng() * 90, r: BUMPER_R });
    bumpers.push({ x, y: 340 + rng() * 110, r: BUMPER_R });
  }
  return bumpers;
}

function fits(c: Circle, placed: Circle[]): boolean {
  if (c.x - c.r < MIN_GAP || c.x + c.r > BOARD.W - MIN_GAP) return false;
  return placed.every((p) => Math.hypot(p.x - c.x, p.y - c.y) - p.r - c.r >= MIN_GAP);
}

/**
 * Best-candidate sampling: each circle tries several random spots and keeps the one farthest from
 * everything already placed. The result is random (no rows or grid) but evenly spread.
 */
function scatter(rng: Rng, count: number, r: number, placed: Circle[]): Circle[] | null {
  const out: Circle[] = [];
  for (let n = 0; n < count; n++) {
    let best: Circle | null = null;
    let bestD = -1;
    for (let tries = 0; tries < 400 && (best === null || tries < CANDIDATES * 4); tries++) {
      const c = { x: r + MIN_GAP + rng() * (BOARD.W - 2 * (r + MIN_GAP)), y: FIELD_TOP + r + rng() * (FIELD_BOTTOM - FIELD_TOP - 2 * r), r };
      if (!fits(c, placed)) continue;
      const d = Math.min(...placed.map((p) => Math.hypot(p.x - c.x, p.y - c.y) - p.r), Infinity);
      if (d > bestD) { best = c; bestD = d; }
    }
    if (!best) return null;
    placed.push(best);
    out.push(best);
  }
  return out;
}

/** Randomly scattered letter balls and plain pegs, plus four curved wall bumpers (two per side). */
export function generateLayout(rng: Rng, pegCount: number, postCount = DEFAULT_POST_COUNT): BoardLayout {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bumpers = placeBumpers(rng);
    const placed: Circle[] = [...bumpers];
    const pegs = scatter(rng, pegCount, BOARD.pegR, placed);
    const posts = pegs && scatter(rng, postCount, POST_R, placed);
    if (pegs && posts) return { pegs, bumpers, posts };
  }
  throw new Error(`Could not fit ${pegCount} letter balls on the board`);
}