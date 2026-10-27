import { generateLayout, type BoardLayout } from './board';
import { hasAnyWord, isWord, findWords } from './dictionary';
import { BLANK, generateLetters } from './letters';
import { simulate, type Shot, type SimResult } from './physics';
import { rngFromSeed } from './rng';
import { DEFAULT_RULES, RULES_VERSION, type GameRules } from './rules';
import { scoreWord, type ScoredLetter } from './scoring';

export type Phase = 'aim' | 'build' | 'done';
export type Mode = 'daily' | 'practice';

export interface PegState {
  letter: string | null;
  /** Letter collected into the current drop's rack; returned or refilled after building. */
  collected: boolean;
}

export interface Tile {
  id: string;
  letter: string;
  pegIndex: number;
  /** Activation order: the global order in which letters were collected. */
  seq: number;
}

export interface PlayedWord {
  word: string;
  letters: ScoredLetter[];
  score: number;
  drop: number;
}

export interface Session {
  seed: string;
  mode: Mode;
  dateKey: string;
  rulesVersion: number;
  rules: GameRules;
  layout: BoardLayout;
  pegs: PegState[];
  queue: string[];
  rack: Tile[];
  dropsUsed: number;
  words: PlayedWord[];
  skips: number;
  phase: Phase;
  nextSeq: number;
  lastCollected: string[];
  shots: Shot[];
  /** Letters in the rack right after each drop, for the end-of-game best-word insight. Missing in older saves. */
  rackHistory?: string[][];
}

export function createSession(seed: string, mode: Mode, dateKey: string, rules: GameRules = DEFAULT_RULES): Session {
  const rng = rngFromSeed(seed);
  const layout = generateLayout(rng, rules.pegCount);
  const letters = generateLetters(rng, rules.pegCount + rules.queueLength, rules.blankChance);
  if (rules.pegCount > 0 && !letters.slice(0, rules.pegCount).includes(BLANK)) {
    letters[Math.floor(rng() * rules.pegCount)] = BLANK;
  }
  return {
    seed,
    mode,
    dateKey,
    rulesVersion: RULES_VERSION,
    rules,
    layout,
    pegs: letters.slice(0, rules.pegCount).map((letter) => ({ letter, collected: false })),
    queue: letters.slice(rules.pegCount),
    rack: [],
    dropsUsed: 0,
    words: [],
    skips: 0,
    phase: 'aim',
    nextSeq: 0,
    lastCollected: [],
    shots: [],
  };
}

export function collectableMask(s: Session): boolean[] {
  return s.pegs.map((p) => p.letter !== null && !p.collected);
}

export function previewShot(s: Session, shot: Shot): SimResult {
  return simulate({
    shot,
    pegs: s.layout.pegs,
    collectable: collectableMask(s),
    bumpers: s.layout.bumpers,
    posts: s.layout.posts ?? [],
    emptySlots: s.pegs.map((p) => p.letter === null),
    capacity: s.rules.rackCapacity - s.rack.length,
  });
}

export function applyDrop(s: Session, shot: Shot): { session: Session; sim: SimResult; collected: Tile[] } {
  if (s.phase !== 'aim') throw new Error(`Cannot drop during phase ${s.phase}`);
  shot = shot.type === 'precision' ? { ...shot, force: 'M' } : shot;
  const sim = previewShot(s, shot);
  const pegs = s.pegs.map((p) => ({ ...p }));
  const collected: Tile[] = [];
  let seq = s.nextSeq;
  for (const hit of sim.hits) {
    const peg = pegs[hit.pegIndex];
    if (!peg.letter || peg.collected) continue;
    peg.collected = true;
    collected.push({ id: `t${seq}`, letter: peg.letter, pegIndex: hit.pegIndex, seq });
    seq++;
  }
  const session: Session = {
    ...s,
    pegs,
    rack: [...s.rack, ...collected],
    dropsUsed: s.dropsUsed + 1,
    phase: 'build',
    nextSeq: seq,
    lastCollected: collected.map((t) => t.id),
    shots: [...s.shots, shot],
    rackHistory: [...(s.rackHistory ?? []), [...s.rack, ...collected].map((t) => t.letter)],
  };
  return { session, sim, collected };
}

export interface Selection {
  tileId: string;
  /** Required for blank tiles: the letter it stands for. */
  as?: string;
}

export interface Refill {
  pegIndex: number;
  letter: string;
  /** Index in the queue before this word was submitted. */
  queueIndex: number;
}

export type SubmitResult =
  | { ok: true; session: Session; word: PlayedWord; refills: Refill[] }
  | { ok: false; error: string };

export function submitWord(s: Session, selection: Selection[]): SubmitResult {
  if (s.phase !== 'build') return { ok: false, error: 'Drop a ball first.' };
  if (s.words.length >= s.rules.maxWords) return { ok: false, error: 'No words left today.' };
  const ids = selection.map((x) => x.tileId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Each tile can only be used once.' };
  const tiles: Tile[] = [];
  const letters: ScoredLetter[] = [];
  for (const sel of selection) {
    const tile = s.rack.find((t) => t.id === sel.tileId);
    if (!tile) return { ok: false, error: 'That tile is no longer in your rack.' };
    if (tile.letter === BLANK) {
      const as = (sel.as ?? '').toUpperCase();
      if (!/^[A-Z]$/.test(as)) return { ok: false, error: 'Choose a letter for the ? tile.' };
      letters.push({ letter: as, blank: true });
    } else {
      letters.push({ letter: tile.letter, blank: false });
    }
    tiles.push(tile);
  }
  const word = letters.map((l) => l.letter).join('');
  if (word.length < s.rules.minWordLength) {
    return { ok: false, error: `Words need at least ${s.rules.minWordLength} letters.` };
  }
  if (!isWord(word)) return { ok: false, error: `${word} isn't in the word list.` };

  const played: PlayedWord = { word, letters, score: scoreWord(letters), drop: s.dropsUsed };
  const pegs = s.pegs.map((p) => ({ ...p }));
  const queue = [...s.queue];
  const refills: Refill[] = [];
  // Refill the board slots of consumed tiles in activation order, from the front of the tray.
  [...tiles].sort((a, b) => a.seq - b.seq).forEach((t, queueIndex) => {
    const next = queue.shift();
    pegs[t.pegIndex] = { letter: next ?? null, collected: false };
    if (next !== undefined) refills.push({ pegIndex: t.pegIndex, letter: next, queueIndex });
  });
  const session = advance({
    ...s,
    pegs,
    queue,
    words: [...s.words, played],
  });
  return { ok: true, session, word: played, refills };
}

/**
 * When the rack can't form any word, every collected letter is destroyed: its board slot is
 * refilled from the tray (like a played word) and the drop stays used.
 */
export function destroyRack(s: Session): { session: Session; refills: Refill[] } {
  if (s.phase !== 'build') return { session: s, refills: [] };
  const pegs = s.pegs.map((p) => ({ ...p }));
  const queue = [...s.queue];
  const refills: Refill[] = [];
  [...s.rack].sort((a, b) => a.seq - b.seq).forEach((t, queueIndex) => {
    const next = queue.shift();
    pegs[t.pegIndex] = { letter: next ?? null, collected: false };
    if (next !== undefined) refills.push({ pegIndex: t.pegIndex, letter: next, queueIndex });
  });
  return { session: advance({ ...s, pegs, queue, skips: s.skips + 1 }), refills };
}

export function skipWord(s: Session): Session {
  if (s.phase !== 'build') return s;
  return advance({ ...s, skips: s.skips + 1 });
}

function advance(s: Session): Session {
  const over = s.dropsUsed >= s.rules.drops || s.words.length >= s.rules.maxWords;
  const pegs = s.pegs.map((p) => ({ ...p, collected: false }));
  return { ...s, pegs, rack: [], phase: over ? 'done' : 'aim', lastCollected: [] };
}

export function rackLetters(s: Session): string[] {
  return s.rack.map((t) => t.letter);
}

export function canFormAnyWord(s: Session): boolean {
  return hasAnyWord(rackLetters(s), s.rules.minWordLength);
}

export function possibleWords(s: Session, limit = 500): string[] {
  return findWords(rackLetters(s), s.rules.minWordLength, limit);
}

/** Tiles that spell `word` from the rack, using real tiles first and blanks only for missing letters. */
export function selectionFor(s: Session, word: string): Selection[] | null {
  const used = new Set<string>();
  const sel: Selection[] = [];
  for (const ch of word.toUpperCase()) {
    const tile = s.rack.find((t) => !used.has(t.id) && t.letter === ch)
      ?? s.rack.find((t) => !used.has(t.id) && t.letter === BLANK);
    if (!tile) return null;
    used.add(tile.id);
    sel.push(tile.letter === BLANK ? { tileId: tile.id, as: ch } : { tileId: tile.id });
  }
  return sel;
}

export interface Suggestion { word: string; score: number; selection: Selection[] }

/**
 * A helper pick that is deliberately not the best: the median-scoring playable word
 * (lower middle when even), so the player still has room to find something better.
 */
export function suggestWord(s: Session, limit = 500): Suggestion | null {
  const options: Suggestion[] = [];
  for (const word of possibleWords(s, limit)) {
    const selection = selectionFor(s, word);
    if (!selection) continue;
    const letters: ScoredLetter[] = selection.map((x, i) => ({ letter: word[i], blank: x.as !== undefined }));
    options.push({ word, score: scoreWord(letters), selection });
  }
  if (!options.length) return null;
  options.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word));
  return options[Math.floor((options.length - 1) / 2)];
}


/** Score of `word` built from `letters`, spending real tiles first and blanks (0 pt) only for missing letters. */
export function scoreFromLetters(word: string, letters: string[]): number | null {
  const pool = new Map<string, number>();
  for (const l of letters) pool.set(l, (pool.get(l) ?? 0) + 1);
  const scored: ScoredLetter[] = [];
  for (const ch of word.toUpperCase()) {
    if ((pool.get(ch) ?? 0) > 0) {
      pool.set(ch, pool.get(ch)! - 1);
      scored.push({ letter: ch, blank: false });
    } else if ((pool.get(BLANK) ?? 0) > 0) {
      pool.set(BLANK, pool.get(BLANK)! - 1);
      scored.push({ letter: ch, blank: true });
    } else return null;
  }
  return scoreWord(scored);
}

/** Highest-scoring dictionary word buildable from `letters` (ties: longer, then alphabetical). */
export function bestWordFrom(letters: string[], minLength: number): { word: string; score: number } | null {
  let best: { word: string; score: number } | null = null;
  for (const word of findWords(letters, minLength)) {
    const score = scoreFromLetters(word, letters);
    if (score === null) continue;
    if (!best || score > best.score || (score === best.score && (word.length > best.word.length || (word.length === best.word.length && word < best.word)))) {
      best = { word, score };
    }
  }
  return best;
}
