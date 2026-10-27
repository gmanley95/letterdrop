import { BLANK, letterValue } from './letters';

export interface ScoredLetter {
  /** The letter the tile represents (a blank's chosen letter). */
  letter: string;
  blank: boolean;
}

/** Scrabble-style base score: sum of letter values; blanks are worth 0. No hidden bonuses. */
export function scoreWord(letters: ScoredLetter[]): number {
  return letters.reduce((sum, l) => sum + (l.blank ? 0 : letterValue(l.letter)), 0);
}

export function bestPossibleScore(word: string, rack: string[]): number {
  const pool = [...rack];
  let total = 0;
  for (const ch of word) {
    const idx = pool.indexOf(ch);
    if (idx >= 0) {
      total += letterValue(ch);
      pool.splice(idx, 1);
    } else {
      const b = pool.indexOf(BLANK);
      if (b < 0) return -1;
      pool.splice(b, 1);
    }
  }
  return total;
}
