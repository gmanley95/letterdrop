import { WORDS } from '../data/words';
import { BLANK } from './letters';

interface Entry { word: string; counts: Uint8Array }

let dict: Set<string> | null = null;
let entries: Entry[] = [];

const A = 65;

function countsOf(word: string): Uint8Array {
  const c = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) c[word.charCodeAt(i) - A]++;
  return c;
}

export function loadDictionary(words: string | string[]): void {
  const list = (Array.isArray(words) ? words : words.split('\n'))
    .map((w) => w.trim().toUpperCase())
    .filter((w) => /^[A-Z]+$/.test(w));
  dict = new Set(list);
  entries = list.map((word) => ({ word, counts: countsOf(word) }));
}

function ensure(): Set<string> {
  if (!dict) loadDictionary(WORDS);
  return dict!;
}

export function normalizeWord(word: string): string {
  return word.trim().toUpperCase();
}

export function isWord(word: string): boolean {
  return ensure().has(normalizeWord(word));
}

function rackCounts(letters: string[]): { counts: Uint8Array; blanks: number } {
  const counts = new Uint8Array(26);
  let blanks = 0;
  for (const l of letters) {
    if (l === BLANK) blanks++;
    else counts[l.charCodeAt(0) - A]++;
  }
  return { counts, blanks };
}

function fits(word: Uint8Array, rack: Uint8Array, blanks: number): boolean {
  let need = 0;
  for (let i = 0; i < 26; i++) {
    const d = word[i] - rack[i];
    if (d > 0) {
      need += d;
      if (need > blanks) return false;
    }
  }
  return true;
}

/** Can `word` be built from `letters` (where '?' is a wildcard)? */
export function canBuild(word: string, letters: string[]): boolean {
  const { counts, blanks } = rackCounts(letters);
  return fits(countsOf(normalizeWord(word)), counts, blanks);
}

/** All dictionary words buildable from the rack, longest first. */
export function findWords(letters: string[], minLength: number, limit = Infinity): string[] {
  ensure();
  const max = letters.length;
  if (max < minLength) return [];
  const { counts, blanks } = rackCounts(letters);
  const out: string[] = [];
  for (const e of entries) {
    const len = e.word.length;
    if (len < minLength || len > max) continue;
    if (fits(e.counts, counts, blanks)) {
      out.push(e.word);
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export function hasAnyWord(letters: string[], minLength: number): boolean {
  return findWords(letters, minLength, 1).length > 0;
}
