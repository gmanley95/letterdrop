export type BallType = 'normal' | 'precision' | 'pass';
export type Force = 'S' | 'M' | 'L';

export interface BallConfig {
  label: string;
  short: string;
  description: string;
  pegRestitution: number;
  wallRestitution: number;
  /** Fraction of tangential speed lost on a peg/bumper contact. */
  friction: number;
  gravityMultiplier: number;
  /** Linear velocity damping per second. */
  damping: number;
  /** 'bounce' = everything; 'solid' = plain pegs, bumpers and empty slots only (passes through letter balls). */
  obstacleCollision: 'bounce' | 'solid';
  wallCollision: 'bounce';
  /** Max letters one drop can collect (Infinity = no cap). */
  maxCollect: number;
  /** Ball comes to rest once slow after touching a letter. */
  settles: boolean;
  /** Show the extended predicted path while aiming (UI limits it to three bounces). */
  fullPreview: boolean;
}

export const BALL_CONFIGS: Record<BallType, BallConfig> = {
  normal: {
    label: 'Normal',
    short: 'Bouncy. Ricochets off letters and bumpers.',
    description: 'Lively bounce off letters, bumpers and walls. Can chain many letters, but its path is hard to call.',
    pegRestitution: 0.62,
    wallRestitution: 0.72,
    friction: 0.05,
    gravityMultiplier: 1,
    damping: 0,
    obstacleCollision: 'bounce',
    wallCollision: 'bounce',
    maxCollect: Infinity,
    settles: false,
    fullPreview: false,
  },
  precision: {
    label: 'Precision',
    short: 'Low bounce, medium force, previews 3 bounces.',
    description: 'Soft, damped bounce at medium force with a preview through the first 3 bounces. Collects letters until the rack is full.',
    pegRestitution: 0.22,
    wallRestitution: 0.4,
    friction: 0.18,
    gravityMultiplier: 0.85,
    damping: 0.55,
    obstacleCollision: 'bounce',
    wallCollision: 'bounce',
    maxCollect: Infinity,
    settles: false,
    fullPreview: true,
  },
  pass: {
    label: 'Pass-through',
    short: 'Ghosts through letters. Bounces off pegs and walls.',
    description: 'Passes straight through letter balls, collecting what it crosses. Bounces off the plain pegs, empty slots, bumpers and walls.',
    pegRestitution: 0.7,
    wallRestitution: 0.92,
    friction: 0,
    gravityMultiplier: 1,
    damping: 0,
    obstacleCollision: 'solid',
    wallCollision: 'bounce',
    maxCollect: 8,
    settles: false,
    fullPreview: false,
  },
};

export const FORCE_SPEED: Record<Force, number> = { S: 170, M: 300, L: 430 };
export const FORCE_LABEL: Record<Force, string> = { S: 'Small', M: 'Medium', L: 'Large' };
export const BALL_TYPES: BallType[] = ['normal', 'precision', 'pass'];
export const FORCES: Force[] = ['S', 'M', 'L'];
