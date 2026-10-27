import type { Rng } from './rng';

export const BLANK = '?';

export const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
  [BLANK]: 0,
};

// Standard English Scrabble tile distribution (blanks handled separately via blankChance).
export const LETTER_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARE = new Set(['J', 'Q', 'X', 'Z']);

const BAG: string[] = Object.entries(LETTER_DISTRIBUTION).flatMap(([l, n]) => Array(n).fill(l));
const VOWEL_BAG = BAG.filter((l) => VOWELS.has(l));

export function letterValue(letter: string): number {
  return LETTER_VALUES[letter.toUpperCase()] ?? 0;
}

function pick(rng: Rng, bag: string[]): string {
  return bag[Math.floor(rng() * bag.length)];
}

/**
 * Generates letters in chunks of 5. Each chunk has at least 2 vowels (or blanks) and
 * at most one rare letter, so every stretch of the board/queue stays playable.
 */
export function generateLetters(rng: Rng, count: number, blankChance: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const chunk: string[] = [];
    for (let i = 0; i < 5; i++) chunk.push(rng() < blankChance ? BLANK : pick(rng, BAG));
    let rareSeen = false;
    for (let i = 0; i < chunk.length; i++) {
      if (RARE.has(chunk[i])) {
        if (rareSeen) chunk[i] = pick(rng, BAG.filter((l) => !RARE.has(l)));
        rareSeen = true;
      }
    }
    const vowelish = () => chunk.filter((l) => VOWELS.has(l) || l === BLANK).length;
    while (vowelish() < 2) {
      const consonants = chunk.map((l, i) => (VOWELS.has(l) || l === BLANK ? -1 : i)).filter((i) => i >= 0);
      chunk[consonants[Math.floor(rng() * consonants.length)]] = pick(rng, VOWEL_BAG);
    }
    if (chunk.includes('Q') && !chunk.includes('U')) {
      const idx = chunk.findIndex((l) => l !== 'Q' && !VOWELS.has(l) && l !== BLANK);
      if (idx >= 0) chunk[idx] = 'U';
    }
    out.push(...chunk);
  }
  return out.slice(0, count);
}
