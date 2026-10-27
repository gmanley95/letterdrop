import { RULES_VERSION } from './rules';

const EPOCH = Date.UTC(2026, 9, 1); // Puzzle #1 = 2026-10-01

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function puzzleNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

export function dailySeed(key: string, rulesVersion = RULES_VERSION): string {
  return `letterdrop-v${rulesVersion}-${key}`;
}

export function practiceSeed(): string {
  return `practice-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function msUntilTomorrow(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
