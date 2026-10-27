import { BALL_CONFIGS, FORCE_SPEED, type BallType, type Force } from './ballConfig';

export const BOARD = {
  W: 360,
  H: 520,
  trayBottom: 44,
  launchY: 53,
  lineY: 62,
  exitY: 518,
  ballR: 6,
  pegR: 13,
  minLaunchX: 20,
  maxLaunchX: 340,
} as const;

export interface Circle { x: number; y: number; r: number }

export interface Shot {
  x: number;
  y?: number;
  /** Radians; 0 = right, PI/2 = straight down. Clamped to the lower half-plane. */
  angle: number;
  force: Force;
  type: BallType;
}

export interface SimInput {
  shot: Shot;
  pegs: Circle[];
  /** Which pegs can still give a letter on this drop. */
  collectable: boolean[];
  bumpers: Circle[];
  /** Peg slots with no letter (tray ran out). Pass-through balls bounce off these. */
  emptySlots?: boolean[];
  /** Plain pegs with no letter; every ball bounces off them. */
  posts?: Circle[];
  /** Remaining rack space; collection stops when it reaches 0. */
  capacity: number;
}

export interface Hit { pegIndex: number; frame: number }

export interface SimResult {
  /** Positions sampled at 60 fps for playback. */
  frames: { x: number; y: number }[];
  hits: Hit[];
  /** Sampled frame indices with an actual collision reflection, deduplicated per frame. */
  bounceFrames: number[];
  end: 'exited' | 'settled' | 'timeout';
}

const DT = 1 / 120;
const SAMPLE_EVERY = 2;
const GRAVITY = 520;
const MAX_TIME = 10;
/** Aim is limited to a downward cone: up to 50° either side of straight down. */
export const AIM_CONE = (50 * Math.PI) / 180;
export const MIN_ANGLE = Math.PI / 2 - AIM_CONE;
export const MAX_ANGLE = Math.PI / 2 + AIM_CONE;

export function clampAngle(angle: number): number {
  return Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle));
}

export function clampLaunchX(x: number): number {
  return Math.min(BOARD.maxLaunchX, Math.max(BOARD.minLaunchX, x));
}

export function clampLaunchY(y: number): number {
  return Math.min(BOARD.lineY - BOARD.ballR, Math.max(BOARD.trayBottom + BOARD.ballR, y));
}

/** Preview frames up to the given bounce (inclusive) and, optionally, no lower than maxY. */
export function previewThroughBounces(sim: SimResult, maxBounces: number, maxY = Infinity): { x: number; y: number }[] {
  if (maxBounces <= 0) return sim.frames.slice(0, 1);
  const frame = sim.bounceFrames[Math.floor(maxBounces) - 1];
  const frames = frame === undefined ? sim.frames.slice() : sim.frames.slice(0, frame + 1);
  const below = frames.findIndex((f) => f.y > maxY);
  return below > 0 ? frames.slice(0, below + 1) : frames;
}

/** Deterministic fixed-step simulation. Same input always yields the same output. */
export function simulate(input: SimInput): SimResult {
  const { shot, pegs, collectable, bumpers } = input;
  const cfg = BALL_CONFIGS[shot.type];
  const r = BOARD.ballR;
  const speed = FORCE_SPEED[shot.type === 'precision' ? 'M' : shot.force];
  const angle = clampAngle(shot.angle);
  let x = clampLaunchX(shot.x);
  let y = clampLaunchY(shot.y ?? BOARD.launchY);
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  const g = GRAVITY * cfg.gravityMultiplier;
  const limit = Math.min(cfg.maxCollect, input.capacity);
  const collected = new Set<number>();
  const hits: Hit[] = [];
  const frames: { x: number; y: number }[] = [{ x, y }];
  const bounceFrames: number[] = [];
  let bounced = false;
  const sample = () => {
    frames.push({ x, y });
    if (bounced) bounceFrames.push(frames.length - 1);
    bounced = false;
  };
  // Pass-through ('solid') ghosts through letter balls but bounces off posts, empty slots, bumpers and walls.
  const posts = input.posts ?? [];
  const obstacles: Circle[] =
    cfg.obstacleCollision === 'bounce'
      ? [...pegs, ...posts, ...bumpers]
      : [...posts, ...pegs.filter((_, i) => input.emptySlots?.[i] === true), ...bumpers];
  const steps = Math.ceil(MAX_TIME / DT);
  let touchedLetter = false;
  let slowSteps = 0;

  for (let step = 1; step <= steps; step++) {
    vy += g * DT;
    if (cfg.damping > 0) {
      const k = Math.max(0, 1 - cfg.damping * DT);
      vx *= k;
      vy *= k;
    }
    x += vx * DT;
    y += vy * DT;

    if (x < r) {
      x = r;
      if (vx < 0) { vx = -vx * cfg.wallRestitution; bounced = true; }
    }
    if (x > BOARD.W - r) {
      x = BOARD.W - r;
      if (vx > 0) { vx = -vx * cfg.wallRestitution; bounced = true; }
    }
    if (y < BOARD.trayBottom + r) {
      y = BOARD.trayBottom + r;
      if (vy < 0) { vy = -vy * cfg.wallRestitution; bounced = true; }
    }

    for (const c of obstacles) {
      const dx = x - c.x;
      const dy = y - c.y;
      const min = c.r + r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      x = c.x + nx * min;
      y = c.y + ny * min;
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        bounced = true;
        const tx = vx - vn * nx;
        const ty = vy - vn * ny;
        const keep = 1 - cfg.friction;
        vx = tx * keep - vn * cfg.pegRestitution * nx;
        vy = ty * keep - vn * cfg.pegRestitution * ny;
        // Avoid balancing forever on top of a peg.
        if (Math.abs(vx) < 12 && ny < -0.9) vx += (dx >= 0 ? 1 : -1) * 30;
      }
    }

    const frame = Math.floor(step / SAMPLE_EVERY);
    if (collected.size < limit) {
      for (let i = 0; i < pegs.length; i++) {
        if (!collectable[i] || collected.has(i)) continue;
        const p = pegs[i];
        const min = p.r + r + 0.5;
        const dx = x - p.x;
        const dy = y - p.y;
        if (dx * dx + dy * dy <= min * min) {
          collected.add(i);
          hits.push({ pegIndex: i, frame });
          touchedLetter = true;
          if (collected.size >= limit) break;
        }
      }
    }

    if (y >= BOARD.exitY) {
      sample();
      return { frames, hits, bounceFrames, end: 'exited' };
    }

    if (step % SAMPLE_EVERY === 0) sample();

    if (cfg.settles && touchedLetter) {
      const sp = Math.hypot(vx, vy);
      slowSteps = sp < 45 ? slowSteps + 1 : 0;
      if (slowSteps > 12 || collected.size >= limit) {
        if (step % SAMPLE_EVERY !== 0) sample();
        return { frames, hits, bounceFrames, end: 'settled' };
      }
    }
  }
  return { frames, hits, bounceFrames, end: 'timeout' };
}
