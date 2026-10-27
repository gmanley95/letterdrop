import { bestWordFrom, type PlayedWord, type Session } from './session';

export interface ResultsSummary {
  total: number;
  shareScore: number;
  topWords: PlayedWord[];
  best: PlayedWord | null;
  words: PlayedWord[];
  unused: string[];
}

export interface BestPossible {
  word: string;
  score: number;
  /** 1-based drop whose letters could have made it. */
  drop: number;
  /** True when one of the played words scored at least this much. */
  found: boolean;
}

/** The best single word any drop's letters allowed. Only meant for the end of the game; null without history. */
export function bestPossible(s: Session): BestPossible | null {
  let best: BestPossible | null = null;
  (s.rackHistory ?? []).forEach((letters, i) => {
    const w = bestWordFrom(letters, s.rules.minWordLength);
    if (w && (!best || w.score > best.score)) best = { ...w, drop: i + 1, found: false };
  });
  if (!best) return null;
  const b: BestPossible = best;
  return { ...b, found: s.words.some((w) => w.score >= b.score) };
}

export function summarize(s: Session): ResultsSummary {
  const sorted = [...s.words].sort((a, b) => b.score - a.score || b.word.length - a.word.length);
  const topWords = sorted.slice(0, s.rules.topWordsForShare);
  return {
    total: s.words.reduce((n, w) => n + w.score, 0),
    shareScore: topWords.reduce((n, w) => n + w.score, 0),
    topWords,
    best: sorted[0] ?? null,
    words: s.words,
    unused: s.rack.map((t) => t.letter),
  };
}

/** Spoiler-free share text: word lengths as squares, scores visible, no letters. */
export function shareText(s: Session, puzzleNo: number): string {
  const r = summarize(s);
  const title = s.mode === 'daily' ? `Letterdrop #${puzzleNo}` : 'Letterdrop practice';
  const top = new Set(r.topWords);
  const lines = s.words.map((w) => `${top.has(w) ? '🟨' : '⬜'}${'🟩'.repeat(w.word.length)} ${w.score}`);
  for (let i = s.words.length; i < s.rules.maxWords; i++) lines.push('⬛ —');
  return [`${title}  ⭐ ${r.shareScore}`, `Top ${s.rules.topWordsForShare} words`, ...lines].join('\n');
}
