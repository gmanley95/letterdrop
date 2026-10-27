/// <reference types="node" />
/**
 * Letterdrop balance simulator / post-design requirement check.
 *   npx tsx scripts/simulate.ts [--rounds 1000] [--greedy 300] [--days 365] [--out docs/balance-results.json]
 * Fully deterministic: every round's seed is recorded in the output.
 */
import { writeFileSync } from 'node:fs';
import { BALL_TYPES, FORCES, type BallType, type Force } from '../src/engine/ballConfig';
import { dailySeed } from '../src/engine/daily';
import { findWords } from '../src/engine/dictionary';
import { BLANK } from '../src/engine/letters';
import { BOARD, MAX_ANGLE, MIN_ANGLE, type Shot } from '../src/engine/physics';
import { mulberry32, rngFromSeed, type Rng } from '../src/engine/rng';
import { RULES_VERSION } from '../src/engine/rules';
import { bestPossibleScore } from '../src/engine/scoring';
import { summarize } from '../src/engine/results';
import {
  applyDrop, createSession, previewShot, rackLetters, skipWord, submitWord, type Selection, type Session,
} from '../src/engine/session';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const ROUNDS = arg('rounds', 1000);
const GREEDY_ROUNDS = arg('greedy', 300);
const DAYS = arg('days', 365);
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : 'docs/balance-results.json';

type Policy = (s: Session, rng: Rng) => Shot;

function randomShot(rng: Rng, type?: BallType, force?: Force): Shot {
  return {
    x: BOARD.minLaunchX + rng() * (BOARD.maxLaunchX - BOARD.minLaunchX),
    angle: MIN_ANGLE + rng() * (MAX_ANGLE - MIN_ANGLE),
    force: force ?? FORCES[Math.floor(rng() * 3)],
    type: type ?? BALL_TYPES[Math.floor(rng() * 3)],
  };
}

const randomPolicy = (type?: BallType, force?: Force): Policy => (_s, rng) => randomShot(rng, type, force);

/** "Aim for letters": samples candidate aims and keeps the one that collects the most letters. */
const mostLettersPolicy = (type?: BallType, candidates = 16): Policy => (s, rng) => {
  let best = randomShot(rng, type);
  let bestN = -1;
  for (let i = 0; i < candidates; i++) {
    const shot = randomShot(rng, type);
    const n = previewShot(s, shot).hits.length;
    if (n > bestN) { bestN = n; best = shot; }
  }
  return best;
};

function bestWord(s: Session): { word: string; score: number } | null {
  const rack = rackLetters(s);
  let best: { word: string; score: number } | null = null;
  for (const w of findWords(rack, s.rules.minWordLength)) {
    const sc = bestPossibleScore(w, rack);
    if (!best || sc > best.score || (sc === best.score && w.length > best.word.length)) best = { word: w, score: sc };
  }
  return best;
}

/** "Thinking player": samples candidate aims across all balls, keeps the one giving the best playable word. */
const greedyScorePolicy = (candidates = 18): Policy => (s, rng) => {
  let best = randomShot(rng);
  let bestScore = -1;
  for (let i = 0; i < candidates; i++) {
    const shot = randomShot(rng);
    const { session } = applyDrop(s, shot);
    const w = bestWord(session);
    const sc = (w?.score ?? 0) + session.rack.length * 0.1;
    if (sc > bestScore) { bestScore = sc; best = shot; }
  }
  return best;
};

function selectionFor(s: Session, word: string): Selection[] {
  const pool = [...s.rack];
  const sel: Selection[] = [];
  for (const ch of word) {
    let idx = pool.findIndex((t) => t.letter === ch);
    if (idx >= 0) { sel.push({ tileId: pool[idx].id }); pool.splice(idx, 1); continue; }
    idx = pool.findIndex((t) => t.letter === BLANK);
    sel.push({ tileId: pool[idx].id, as: ch });
    pool.splice(idx, 1);
  }
  return sel;
}

interface DropStat { type: BallType; force: Force; letters: number; rackFull: boolean; wordsAvailable: number }
interface RoundStat {
  seed: string; policy: string; shareScore: number; total: number; wordsSubmitted: number;
  zeroWordPhases: number; blanksSeen: number; blanksUsed: number; drops: DropStat[]; words: string[];
}

function playRound(seed: string, policyName: string, policy: Policy, mode: 'daily' | 'practice' = 'practice'): RoundStat {
  let s = createSession(seed, mode, '2026-10-09');
  const rng = mulberry32(rngFromSeed(seed + policyName)() * 2 ** 32);
  const drops: DropStat[] = [];
  let zeroWordPhases = 0, blanksSeen = 0, blanksUsed = 0;
  while (s.phase !== 'done') {
    const shot = policy(s, rng);
    const rackFull = s.rack.length >= s.rules.rackCapacity;
    const res = applyDrop(s, shot);
    s = res.session;
    blanksSeen += res.collected.filter((t) => t.letter === BLANK).length;
    const available = findWords(rackLetters(s), s.rules.minWordLength).length;
    drops.push({ type: shot.type, force: shot.force, letters: res.collected.length, rackFull, wordsAvailable: available });
    if (available === 0) { zeroWordPhases++; s = skipWord(s); continue; }
    const w = bestWord(s)!;
    const sub = submitWord(s, selectionFor(s, w.word));
    if (!sub.ok) throw new Error(`Sim submit failed: ${sub.error} (${w.word})`);
    blanksUsed += sub.word.letters.filter((l) => l.blank).length;
    s = sub.session;
  }
  const r = summarize(s);
  return {
    seed, policy: policyName, shareScore: r.shareScore, total: r.total, wordsSubmitted: s.words.length,
    zeroWordPhases, blanksSeen, blanksUsed, drops, words: s.words.map((w) => w.word),
  };
}

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
};
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

function describe(rounds: RoundStat[]) {
  const scores = rounds.map((r) => r.shareScore);
  const drops = rounds.flatMap((r) => r.drops);
  const words = rounds.map((r) => r.wordsSubmitted);
  const bucket = (lo: number, hi: number) => r2((100 * words.filter((w) => w >= lo && w <= hi).length) / words.length);
  return {
    rounds: rounds.length,
    shareScore: { min: pct(scores, 0), median: pct(scores, 50), p75: pct(scores, 75), p90: pct(scores, 90), max: pct(scores, 100), mean: r2(mean(scores)) },
    lettersPerDrop: r2(mean(drops.map((d) => d.letters))),
    lettersPerRound: r2(mean(rounds.map((r) => r.drops.reduce((n, d) => n + d.letters, 0)))),
    zeroLetterDropsPct: r2((100 * drops.filter((d) => d.letters === 0).length) / drops.length),
    rackFullDropsPct: r2((100 * drops.filter((d) => d.rackFull).length) / drops.length),
    wordsAvailablePerBuildPhase: { median: pct(drops.map((d) => d.wordsAvailable), 50), mean: r2(mean(drops.map((d) => d.wordsAvailable))) },
    zeroWordPhasesPct: r2((100 * drops.filter((d) => d.wordsAvailable === 0).length) / drops.length),
    wordsSubmitted: { mean: r2(mean(words)), pct0: bucket(0, 0), pct1to2: bucket(1, 2), pct3to4: bucket(3, 4), pct5: bucket(5, 5) },
    roundsWithNoWordsPct: r2((100 * words.filter((w) => w === 0).length) / words.length),
    blanks: {
      perRound: r2(mean(rounds.map((r) => r.blanksSeen))),
      usedPerRound: r2(mean(rounds.map((r) => r.blanksUsed))),
      meanScoreWithBlank: r2(mean(rounds.filter((r) => r.blanksSeen > 0).map((r) => r.shareScore))),
      meanScoreWithoutBlank: r2(mean(rounds.filter((r) => r.blanksSeen === 0).map((r) => r.shareScore))),
    },
  };
}

function topRepeats(rounds: RoundStat[]) {
  const counts = new Map<string, number>();
  for (const r of rounds) for (const w of r.words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const totalWords = rounds.reduce((n, r) => n + r.words.length, 0);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([w, n]) => ({ word: w, count: n, pctOfWords: r2((100 * n) / totalWords) }));
}

const t0 = Date.now();
const report: Record<string, unknown> = {
  rulesVersion: RULES_VERSION,
  generatedAt: new Date().toISOString(),
  config: { ROUNDS, GREEDY_ROUNDS, DAYS },
};

// 1. Random play across all balls/forces.
const randomRounds = Array.from({ length: ROUNDS }, (_, i) => playRound(`sim-${i}`, 'random', randomPolicy()));
report.random = describe(randomRounds);
console.log('random done', (Date.now() - t0) / 1000);

// 2. Per ball type ("aim for letters").
const byType: Record<string, unknown> = {};
for (const t of BALL_TYPES) {
  const rs = Array.from({ length: Math.round(ROUNDS / 2) }, (_, i) => playRound(`sim-${i}`, `letters-${t}`, mostLettersPolicy(t)));
  byType[t] = describe(rs);
}
report.byBallTypeAimForLetters = byType;
console.log('by type done', (Date.now() - t0) / 1000);

// 3. Per force (random aim).
const byForce: Record<string, unknown> = {};
for (const f of FORCES) {
  const rs = Array.from({ length: Math.round(ROUNDS / 2) }, (_, i) => playRound(`sim-${i}`, `force-${f}`, randomPolicy(undefined, f)));
  byForce[f] = describe(rs);
}
report.byForceRandomAim = byForce;
console.log('by force done', (Date.now() - t0) / 1000);

// 4. Strategic player.
const greedy = Array.from({ length: GREEDY_ROUNDS }, (_, i) => playRound(`sim-${i}`, 'greedy', greedyScorePolicy()));
report.greedyScore = describe(greedy);
const typeShare: Record<string, number> = {};
const forceShare: Record<string, number> = {};
for (const d of greedy.flatMap((r) => r.drops)) {
  typeShare[d.type] = (typeShare[d.type] ?? 0) + 1;
  forceShare[d.force] = (forceShare[d.force] ?? 0) + 1;
}
const nd = greedy.length * 5;
report.greedyChoices = {
  ballType: Object.fromEntries(Object.entries(typeShare).map(([k, v]) => [k, r2((100 * v) / nd)])),
  force: Object.fromEntries(Object.entries(forceShare).map(([k, v]) => [k, r2((100 * v) / nd)])),
};
report.greedyRepeatedWords = topRepeats(greedy);
console.log('greedy done', (Date.now() - t0) / 1000);

// 5. Daily boards: one year of real daily seeds, random + strategic players.
const start = new Date(2026, 9, 1);
const days: string[] = Array.from({ length: DAYS }, (_, i) => {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const dailyRandom = days.map((k) => playRound(dailySeed(k), 'random', randomPolicy(), 'daily'));
const dailyGreedy = days.map((k) => playRound(dailySeed(k), 'greedy', greedyScorePolicy(12), 'daily'));
report.dailyRandom = describe(dailyRandom);
report.dailyGreedy = describe(dailyGreedy);
const dayScores = dailyGreedy.map((r, i) => ({ day: days[i], score: r.shareScore, words: r.wordsSubmitted }));
report.dailyWorstDays = [...dayScores].sort((a, b) => a.score - b.score).slice(0, 5);
report.dailyBestDays = [...dayScores].sort((a, b) => b.score - a.score).slice(0, 5);
report.dailyDaysWithZeroWordsStrategic = dayScores.filter((d) => d.words === 0).length;

// 6. Board richness: how many words the opening board + first 12 tray letters can make.
report.dailyBoardWordPool = (() => {
  const counts = days.map((k) => {
    const s = createSession(dailySeed(k), 'daily', k);
    return findWords(s.pegs.map((p) => p.letter!), 3).length;
  });
  return { min: pct(counts, 0), median: pct(counts, 50), max: pct(counts, 100) };
})();

report.runtimeSeconds = r2((Date.now() - t0) / 1000);
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
