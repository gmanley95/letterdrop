import { BALL_CONFIGS } from '../src/engine/ballConfig';
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST_R, generateLayout } from '../src/engine/board';
import { dailySeed, puzzleNumber } from '../src/engine/daily';
import { canBuild, findWords, hasAnyWord, isWord } from '../src/engine/dictionary';
import { BLANK, generateLetters, letterValue } from '../src/engine/letters';
import { BOARD, MAX_ANGLE, MIN_ANGLE, clampAngle, clampLaunchY, previewThroughBounces, simulate, type Circle } from '../src/engine/physics';
import { bestPossible, shareText, summarize } from '../src/engine/results';
import { rngFromSeed } from '../src/engine/rng';
import { DEFAULT_RULES, RULES_VERSION } from '../src/engine/rules';
import { scoreWord } from '../src/engine/scoring';
import { applyDrop, bestWordFrom, createSession, destroyRack, scoreFromLetters, selectionFor, skipWord, suggestWord, submitWord, type Session, type Tile } from '../src/engine/session';

/** Session in build phase with a hand-picked rack (letters sit on pegs 0..n-1). */
function withRack(letters: string[], queue = ['X', 'Y', 'Z']): Session {
  const s = createSession('test-seed', 'practice', '2026-10-09');
  const rack: Tile[] = letters.map((letter, i) => ({ id: `t${i}`, letter, pegIndex: i, seq: i }));
  const pegs = s.pegs.map((p, i) => (i < letters.length ? { letter: letters[i], collected: true } : p));
  return { ...s, pegs, rack, queue, phase: 'build', dropsUsed: 1, nextSeq: letters.length };
}

test('Scrabble letter values and blank = 0', () => {
  assert.equal(letterValue('A'), 1);
  assert.equal(letterValue('Q'), 10);
  assert.equal(letterValue('Z'), 10);
  assert.equal(letterValue('K'), 5);
  assert.equal(letterValue(BLANK), 0);
});

test('word score is plain sum, repeated letters count each time, blanks score 0', () => {
  const l = (s: string) => s.split('').map((letter) => ({ letter, blank: false }));
  assert.equal(scoreWord(l('CAT')), 5);
  assert.equal(scoreWord(l('JAZZ')), 29);
  assert.equal(scoreWord([{ letter: 'J', blank: false }, { letter: 'A', blank: false }, { letter: 'Z', blank: true }, { letter: 'Z', blank: false }]), 19);
});

test('dictionary lookup, wildcard building and search', () => {
  assert.ok(isWord('cat'));
  assert.ok(!isWord('xqzt'));
  assert.ok(canBuild('CAT', ['C', 'A', 'T']));
  assert.ok(!canBuild('CAT', ['C', 'A']));
  assert.ok(canBuild('CAT', ['C', BLANK, 'T']));
  assert.ok(!canBuild('TOOT', ['T', 'O', 'T']), 'duplicate letters need duplicate tiles');
  assert.ok(findWords(['C', 'A', 'T', 'S'], 3).includes('CATS'));
  assert.ok(!hasAnyWord(['Q', 'X', 'Z'], 3));
  assert.ok(!hasAnyWord(['A', 'T'], 3), 'too few letters');
});

test('invalid words do not consume tiles', () => {
  const s = withRack(['C', 'A', 'T', 'Q']);
  const before = structuredClone(s);
  const r = submitWord(s, [{ tileId: 't3' }, { tileId: 't1' }, { tileId: 't0' }]);
  assert.equal(r.ok, false);
  const short = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }]);
  assert.equal(short.ok, false);
  const dup = submitWord(s, [{ tileId: 't0' }, { tileId: 't0' }, { tileId: 't1' }]);
  assert.equal(dup.ok, false);
  assert.equal(s.rack.length, 4);
  assert.deepEqual(s, before, 'invalid submissions leave the complete session unchanged');
});

test('valid word consumes exactly the selected tiles and scores correctly', () => {
  const s = withRack(['C', 'A', 'T', 'Q']);
  const r = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.word.word, 'CAT');
  assert.equal(r.word.score, 5);
  assert.deepEqual(r.session.rack, []);
  assert.deepEqual(r.session.pegs[3], { letter: 'Q', collected: false });
  assert.deepEqual(r.session.pegs.slice(4), s.pegs.slice(4), 'unrelated slots are never refilled');
  assert.deepEqual(s.rack.map((t) => t.id), ['t0', 't1', 't2', 't3'], 'input is unchanged');
  assert.equal(r.session.phase, 'aim');
});

test('refill uses the tray in activation order, not selection order', () => {
  const s = withRack(['C', 'A', 'T'], ['M', 'N', 'O', 'P']);
  // Spell T-A-C? not a word; spell "ACT" selecting in order A(t1), C(t0), T(t2).
  const r = submitWord(s, [{ tileId: 't1' }, { tileId: 't0' }, { tileId: 't2' }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.word.word, 'ACT');
  // t0 (seq 0, peg 0) gets M, t1 (peg 1) gets N, t2 (peg 2) gets O.
  assert.equal(r.session.pegs[0].letter, 'M');
  assert.equal(r.session.pegs[1].letter, 'N');
  assert.equal(r.session.pegs[2].letter, 'O');
  assert.ok(!r.session.pegs[0].collected);
  assert.deepEqual(r.session.queue, ['P']);
  assert.deepEqual(r.refills, [
    { pegIndex: 0, letter: 'M', queueIndex: 0 },
    { pegIndex: 1, letter: 'N', queueIndex: 1 },
    { pegIndex: 2, letter: 'O', queueIndex: 2 },
  ]);
});

test('BARK refills OARK in collection order even when the rack is reordered', () => {
  const s = withRack(['B', 'A', 'R', 'K', 'Q'], ['O', 'A', 'R', 'K', 'Z']);
  s.rack.reverse();
  const r = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }, { tileId: 't3' }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.word.word, 'BARK');
  assert.deepEqual(r.session.pegs.slice(0, 4).map((p) => p.letter), ['O', 'A', 'R', 'K']);
  assert.deepEqual(r.refills, [
    { pegIndex: 0, letter: 'O', queueIndex: 0 },
    { pegIndex: 1, letter: 'A', queueIndex: 1 },
    { pegIndex: 2, letter: 'R', queueIndex: 2 },
    { pegIndex: 3, letter: 'K', queueIndex: 3 },
  ]);
  assert.deepEqual(r.session.pegs[4], { letter: 'Q', collected: false });
  assert.deepEqual(r.session.queue, ['Z']);
});

test('empty tray leaves used slots empty', () => {
  const s = withRack(['C', 'A', 'T'], ['M']);
  const r = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.session.pegs[0].letter, 'M');
  assert.equal(r.session.pegs[1].letter, null);
  assert.equal(r.session.pegs[2].letter, null);
  assert.deepEqual(r.refills, [{ pegIndex: 0, letter: 'M', queueIndex: 0 }]);
});

test('blank tile requires a chosen letter and scores 0', () => {
  const s = withRack(['C', BLANK, 'T']);
  s.pegs = s.pegs.map((p, i) => i < 3 ? p : { ...p, letter: 'A' });
  assert.equal(submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }]).ok, false);
  const r = submitWord(s, [{ tileId: 't0' }, { tileId: 't1', as: 'a' }, { tileId: 't2' }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.word.word, 'CAT');
  assert.equal(r.word.score, 4);
  assert.ok(!r.session.pegs.some((p) => p.letter === BLANK), 'consuming the last blank does not refill unrelated slots');
});

const OPEN: Circle[] = [];
const peg = (x: number, y: number): Circle => ({ x, y, r: BOARD.pegR });

test('physics is deterministic', () => {
  const s = createSession(dailySeed('2026-10-09'), 'daily', '2026-10-09');
  const shot = { x: 150, angle: 1.3, force: 'M' as const, type: 'normal' as const };
  const a = simulate({ shot, pegs: s.layout.pegs, collectable: s.pegs.map(() => true), bumpers: s.layout.bumpers, capacity: 10 });
  const b = simulate({ shot, pegs: s.layout.pegs, collectable: s.pegs.map(() => true), bumpers: s.layout.bumpers, capacity: 10 });
  assert.deepEqual(a, b);
});

test('a ball collects each letter at most once per drop', () => {
  for (const type of ['normal', 'precision', 'pass'] as const) {
    for (let i = 0; i < 30; i++) {
      const s = createSession(`dup-${i}`, 'practice', '2026-10-09');
      const { sim } = applyDrop(s, { x: 30 + i * 10, angle: 0.3 + i * 0.08, force: (['S', 'M', 'L'] as const)[i % 3], type });
      const ids = sim.hits.map((h) => h.pegIndex);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('normal ball bounces off a letter ball; pass-through ghosts through it but bounces off walls', () => {
  const blocker = [peg(180, 200)];
  const shot = { x: 180, angle: Math.PI / 2, force: 'S' as const };
  const normal = simulate({ shot: { ...shot, type: 'normal' }, pegs: blocker, collectable: [true], bumpers: OPEN, capacity: 10 });
  const pass = simulate({ shot: { ...shot, type: 'pass' }, pegs: blocker, collectable: [true], bumpers: OPEN, capacity: 10 });
  const passedThrough = pass.frames.some((f) => Math.abs(f.x - 180) < 1 && Math.abs(f.y - 200) < 6);
  const normalInside = normal.frames.some((f) => Math.hypot(f.x - 180, f.y - 200) < BOARD.pegR);
  assert.ok(passedThrough, 'pass-through should travel through the peg centre');
  assert.ok(!normalInside, 'normal ball must not overlap the peg');
  assert.equal(pass.hits.length, 1, 'pass-through still collects the letter');

  const wall = simulate({ shot: { x: 300, angle: MIN_ANGLE, force: 'L', type: 'pass' }, pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10 });
  assert.ok(wall.frames.every((f) => f.x <= BOARD.W - BOARD.ballR + 0.01));
  assert.ok(wall.frames.some((f, i) => i > 0 && f.x < wall.frames[i - 1].x), 'should rebound off the right wall');
});

test('pass-through bounces off plain pegs, bumpers and empty slots', () => {
  const shot = { x: 180, angle: Math.PI / 2, force: 'S' as const, type: 'pass' as const };
  const post = { x: 180, y: 200, r: POST_R };
  const viaPost = simulate({ shot, pegs: OPEN, collectable: [], bumpers: OPEN, posts: [post], capacity: 10 });
  assert.ok(!viaPost.frames.some((f) => Math.hypot(f.x - 180, f.y - 200) < POST_R), 'must not overlap a plain peg');

  const viaBumper = simulate({ shot, pegs: OPEN, collectable: [], bumpers: [{ x: 180, y: 220, r: 30 }], capacity: 10 });
  assert.ok(!viaBumper.frames.some((f) => Math.hypot(f.x - 180, f.y - 220) < 30), 'must not overlap a bumper');

  const empty = simulate({ shot, pegs: [peg(180, 200)], collectable: [false], emptySlots: [true], bumpers: OPEN, capacity: 10 });
  assert.ok(!empty.frames.some((f) => Math.hypot(f.x - 180, f.y - 200) < BOARD.pegR), 'must not overlap an empty slot');
});

test('layout includes plain pegs that do not overlap letter balls', () => {
  const s = createSession(dailySeed('2026-10-09'), 'daily', '2026-10-09');
  const posts = s.layout.posts ?? [];
  assert.ok(posts.length > 0);
  for (const p of posts) {
    for (const c of s.layout.pegs) assert.ok(Math.hypot(p.x - c.x, p.y - c.y) > p.r + c.r);
  }
});

test('aim angle is clamped to the downward cone', () => {
  assert.equal(clampAngle(0), MIN_ANGLE);
  assert.equal(clampAngle(Math.PI), MAX_ANGLE);
  assert.equal(clampAngle(-1), MIN_ANGLE);
  assert.equal(clampAngle(Math.PI / 2), Math.PI / 2);
  const flat = simulate({ shot: { x: 180, angle: 0, force: 'L', type: 'normal' }, pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10 });
  const dy = flat.frames[1].y - flat.frames[0].y;
  const dx = flat.frames[1].x - flat.frames[0].x;
  assert.ok(Math.atan2(dy, dx) >= MIN_ANGLE - 0.05, 'launch direction honors the cone');
});

test('precision always uses medium force and records the effective force', () => {
  const s = createSession(dailySeed('2026-10-09'), 'daily', '2026-10-09');
  for (let i = 0; i < 10; i++) {
    const shot = { x: 40 + i * 27, y: 65, angle: 0.5 + i * 0.17, force: 'M' as const, type: 'precision' as const };
    const expected = applyDrop(s, shot).sim;
    for (const force of ['S', 'M', 'L'] as const) {
      const input = { ...shot, force };
      const { session, sim } = applyDrop(s, input);
      assert.deepEqual(sim, expected);
      assert.equal(session.shots[0].force, 'M');
      assert.equal(input.force, force, 'normalization does not mutate input');
      assert.notEqual(sim.end, 'settled', 'precision has no automatic settle');
    }
  }
  const base = { x: 180, y: 65, angle: Math.PI / 2, type: 'precision' as const };
  const sims = (['S', 'M', 'L'] as const).map((force) => simulate({
    shot: { ...base, force }, pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10,
  }));
  assert.deepEqual(sims[0], sims[1]);
  assert.deepEqual(sims[2], sims[1]);
});

test('launch y keeps the entire ball in the launch area and stops at the dotted exit line', () => {
  assert.equal(clampLaunchY(-100), BOARD.trayBottom + BOARD.ballR);
  assert.equal(clampLaunchY(1000), BOARD.lineY - BOARD.ballR);
  assert.equal(clampLaunchY(BOARD.launchY), BOARD.launchY);
  assert.ok(BOARD.lineY - BOARD.trayBottom <= 1.5 * 2 * BOARD.ballR, 'launch zone is 1.5 balls tall');
  for (const y of [undefined, -100, 55, 1000]) {
    const sim = simulate({ shot: { x: 180, y, angle: Math.PI / 2, force: 'M', type: 'normal' },
      pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10 });
    assert.equal(sim.frames[0].y, clampLaunchY(y ?? BOARD.launchY));
    assert.equal(sim.end, 'exited');
    assert.ok(sim.frames.at(-1)!.y >= BOARD.exitY);
    assert.ok(sim.frames.slice(0, -1).every((f) => f.y < BOARD.exitY));
    assert.ok(sim.frames.at(-1)!.y < BOARD.H + BOARD.ballR, 'does not continue to the old offscreen exit');
  }
});

test('bounce frames include real letter, post, bumper and wall reflections but not pass-through collection', () => {
  const shot = { x: 180, angle: Math.PI / 2, force: 'M' as const, type: 'normal' as const };
  const base = { shot, pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10 };
  const open = simulate(base);
  assert.deepEqual(open.bounceFrames, []);
  const letter = simulate({ ...base, pegs: [peg(180, 200)], collectable: [true] });
  const post = simulate({ ...base, posts: [{ x: 180, y: 200, r: POST_R }] });
  const bumper = simulate({ ...base, bumpers: [{ x: 180, y: 200, r: 30 }] });
  const wall = simulate({ ...base, shot: { ...shot, x: 340, angle: MIN_ANGLE, force: 'L' } });
  for (const sim of [letter, post, bumper, wall]) {
    assert.ok(sim.bounceFrames.length > 0);
    assert.equal(new Set(sim.bounceFrames).size, sim.bounceFrames.length);
    assert.ok(sim.bounceFrames.every((f, i) => f > 0 && f < sim.frames.length && (i === 0 || f > sim.bounceFrames[i - 1])));
  }
  const pass = simulate({ ...base, shot: { ...shot, type: 'pass' }, pegs: [peg(180, 200)], collectable: [true] });
  assert.equal(pass.hits.length, 1);
  assert.deepEqual(pass.bounceFrames, []);
  const first = letter.bounceFrames[0];
  assert.ok(letter.frames[first].y > letter.frames[first - 1].y && letter.frames[first + 1].y < letter.frames[first].y, 'the indexed sample is the reflection point');
});

test('precision preview ends at its third actual bounce inclusive', () => {
  const sim = simulate({
    shot: { x: 181, angle: Math.PI / 2, force: 'M', type: 'precision' },
    pegs: [peg(180, 200), peg(198, 236), peg(228, 272)], collectable: [true, true, true], bumpers: OPEN, capacity: 10,
  });
  assert.ok(sim.bounceFrames.length >= 3, 'fixture must have at least three actual bounces');
  const preview = previewThroughBounces(sim, 3);
  assert.deepEqual(preview, sim.frames.slice(0, sim.bounceFrames[2] + 1));
  assert.deepEqual(preview.at(-1), sim.frames[sim.bounceFrames[2]]);
  assert.deepEqual(previewThroughBounces(sim, sim.bounceFrames.length + 1), sim.frames);
  assert.deepEqual(previewThroughBounces(sim, 0), sim.frames.slice(0, 1));
});

test('collection respects remaining rack space', () => {
  const s = createSession('cap', 'practice', '2026-10-09');
  const r = simulate({ shot: { x: 180, angle: Math.PI / 2, force: 'L', type: 'normal' }, pegs: s.layout.pegs, collectable: s.pegs.map(() => true), bumpers: s.layout.bumpers, capacity: 1 });
  assert.ok(r.hits.length <= 1);
});

test('game ends after 5 drops', () => {
  let s = createSession('five', 'practice', '2026-10-09');
  for (let i = 0; i < 5; i++) {
    assert.equal(s.phase, 'aim');
    s = applyDrop(s, { x: 60 + i * 50, angle: 1.4, force: 'M', type: 'normal' }).session;
    s = skipWord(s);
  }
  assert.equal(s.phase, 'done');
  assert.throws(() => applyDrop(s, { x: 100, angle: 1.4, force: 'M', type: 'normal' }));
});

test('daily seed is stable; different days differ', () => {
  const a = createSession(dailySeed('2026-10-09'), 'daily', '2026-10-09');
  const b = createSession(dailySeed('2026-10-09'), 'daily', '2026-10-09');
  const c = createSession(dailySeed('2026-10-10'), 'daily', '2026-10-10');
  assert.deepEqual(a.pegs, b.pegs);
  assert.deepEqual(a.layout, b.layout);
  assert.notDeepEqual(a.pegs.map((p) => p.letter).concat(a.queue), c.pegs.map((p) => p.letter).concat(c.queue));
  assert.equal(puzzleNumber('2026-10-01'), 1);
  assert.equal(puzzleNumber('2026-10-09'), 9);
});

test('letter generator: vowel guarantee and Q comes with U', () => {
  const letters = generateLetters(rngFromSeed('gen'), 2000, 0.05);
  for (let i = 0; i + 5 <= letters.length; i += 5) {
    const chunk = letters.slice(i, i + 5);
    assert.ok(chunk.filter((l) => 'AEIOU?'.includes(l)).length >= 2, `chunk ${chunk.join('')}`);
  }
  const qs = letters.filter((l) => l === 'Q').length;
  if (qs) assert.ok(letters.filter((l) => l === 'U').length >= qs);
});

test('every opening board has a blank across many seeds, including a zero blank chance', () => {
  assert.equal(RULES_VERSION, 7);
  for (let seed = 0; seed < 1000; seed++) {
    for (const blankChance of [DEFAULT_RULES.blankChance, 0]) {
      const s = createSession(`blank-${seed}`, 'practice', '2026-10-09', { ...DEFAULT_RULES, blankChance });
      assert.ok(s.pegs.some((p) => p.letter === BLANK), `missing blank for seed ${seed}`);
      assert.equal(s.queue.length, s.rules.queueLength);
    }
  }
});

test('layout keeps pegs apart and inside the board', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const layout = generateLayout(rngFromSeed(`lay-${seed}`), DEFAULT_RULES.pegCount);
    assert.equal(layout.pegs.length, 30);
    assert.equal(layout.bumpers.length, 4);
    assert.equal(layout.posts?.length, 6);
    const circles = [...layout.pegs, ...(layout.posts ?? [])];
    for (let i = 0; i < circles.length; i++) {
      const p = circles[i];
      assert.ok(p.x - p.r >= 0 && p.x + p.r <= BOARD.W);
      assert.ok(p.y - p.r > BOARD.lineY && p.y + p.r < BOARD.H);
      for (const q of circles.slice(i + 1)) {
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r > 2 * BOARD.ballR + 1, `ball can't fit between circles on seed ${seed}`);
      }
      for (const b of layout.bumpers) {
        assert.ok(Math.hypot(p.x - b.x, p.y - b.y) - p.r - b.r > 2 * BOARD.ballR + 1, 'ball fits between letters and bumpers');
      }
    }
  }
});

test('share score is the top 3 of up to 5 words; share text hides letters', () => {
  let s = withRack(['C', 'A', 'T']);
  s = { ...s, words: [
    { word: 'CAT', letters: [], score: 5, drop: 1 },
    { word: 'JAZZ', letters: [], score: 29, drop: 2 },
    { word: 'DOG', letters: [], score: 5, drop: 3 },
    { word: 'QUIZ', letters: [], score: 22, drop: 4 },
    { word: 'TEN', letters: [], score: 3, drop: 5 },
  ] };
  const r = summarize(s);
  assert.equal(r.shareScore, 29 + 22 + 5);
  assert.equal(r.total, 64);
  const text = shareText(s, 9);
  assert.ok(text.includes('⭐ 56'));
  assert.ok(!/JAZZ|QUIZ|CAT/.test(text));
});

test('skipping returns all letters to their original slots and clears a full rack', () => {
  const s = withRack(['Q', 'X', 'Z', 'J', 'V', 'K', 'W', 'Q', 'X', 'Z']);
  assert.ok(!hasAnyWord(s.rack.map((t) => t.letter), 3));
  const next = skipWord(s);
  assert.equal(next.phase, 'aim');
  assert.deepEqual(next.rack, []);
  assert.deepEqual(next.queue, s.queue);
  assert.deepEqual(next.pegs.map((p) => p.letter), s.pegs.map((p) => p.letter));
  assert.ok(next.pegs.every((p) => !p.collected));
  assert.equal(next.skips, 1);
  assert.equal(s.rack.length, 10, 'original session is unchanged');
});

test('unused letters must be rehit on the next drop after submitting or skipping', () => {
  const s = withRack(['C', 'A', 'T', 'Q']);
  s.layout = { ...s.layout, bumpers: [], posts: [],
    pegs: s.layout.pegs.map((p, i) => ({ ...p, x: i === 3 ? 180 : -1000 - i * 100, y: 200 })) };
  const submitted = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }]);
  assert.ok(submitted.ok);
  if (!submitted.ok) return;
  for (const next of [submitted.session, skipWord(s)]) {
    assert.equal(next.rack.length, 0);
    const miss = applyDrop(next, { x: 40, angle: Math.PI / 2, force: 'M', type: 'normal' });
    assert.equal(miss.collected.length, 0, 'returned letter is not automatically carried forward');
    const hit = applyDrop(next, { x: 180, angle: Math.PI / 2, force: 'M', type: 'normal' });
    assert.deepEqual(hit.collected.map((t) => t.letter), ['Q']);
    assert.equal(hit.collected[0].pegIndex, 3);
    assert.ok(hit.collected[0].seq >= s.nextSeq);
  }
});

test('the final submit or skip also clears the rack and returns unused letters', () => {
  const s = { ...withRack(['C', 'A', 'T', 'Q']), dropsUsed: DEFAULT_RULES.drops };
  const result = submitWord(s, [{ tileId: 't0' }, { tileId: 't1' }, { tileId: 't2' }]);
  assert.ok(result.ok);
  if (!result.ok) return;
  for (const next of [result.session, skipWord(s)]) {
    assert.equal(next.phase, 'done');
    assert.deepEqual(next.rack, []);
    assert.deepEqual(next.lastCollected, []);
    assert.deepEqual(next.pegs[3], { letter: 'Q', collected: false });
  }
});

test('when no word can be formed, all collected letters are destroyed and refilled from the tray', () => {
  const s = withRack(['Q', 'X', 'Z', 'J', 'V'], ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.ok(!hasAnyWord(s.rack.map((t) => t.letter), 3));
  const { session: next, refills } = destroyRack(s);
  assert.deepEqual(next.rack, []);
  assert.equal(next.dropsUsed, s.dropsUsed, 'the drop stays used');
  assert.equal(next.words.length, 0);
  assert.equal(next.queue.length, s.queue.length - s.rack.length);
  const order = [...s.rack].sort((a, b) => a.seq - b.seq);
  assert.deepEqual(refills.map((r) => r.pegIndex), order.map((t) => t.pegIndex));
  order.forEach((t, i) => {
    assert.equal(next.pegs[t.pegIndex].letter, s.queue[i]);
    assert.equal(refills[i].letter, s.queue[i]);
  });
  assert.ok(next.pegs.every((p) => !p.collected));
});

test('the opening board has exactly 30 letter balls', () => {
  const s = createSession('count-27', 'daily', '2026-01-01');
  assert.equal(s.pegs.length, 30);
  assert.ok(s.pegs.some((p) => p.letter === BLANK));
});

test('letter balls are scattered randomly, not on fixed rows', () => {
  const a = generateLayout(rngFromSeed('scatter-a'), 30);
  const b = generateLayout(rngFromSeed('scatter-b'), 30);
  const rows = new Set(a.pegs.map((p) => Math.round(p.y / 10)));
  assert.ok(rows.size > 20, 'y positions are not a handful of rows');
  assert.notDeepEqual(a.pegs.map((p) => Math.round(p.x)), b.pegs.map((p) => Math.round(p.x)));
  const postXs = (a.posts ?? []).map((p) => p.x);
  assert.ok(!postXs.every((x) => x === BOARD.W / 2), 'plain pegs are not centered in a column');
});

test('precision preview stops halfway down the board when that comes before the third bounce', () => {
  const sim = simulate({ shot: { x: 180, angle: Math.PI / 2, force: 'M', type: 'precision' },
    pegs: OPEN, collectable: [], bumpers: OPEN, capacity: 10 });
  const preview = previewThroughBounces(sim, 3, BOARD.H / 2);
  assert.ok(preview.length < sim.frames.length);
  assert.ok(preview.slice(0, -1).every((f) => f.y <= BOARD.H / 2));
  assert.ok(preview.at(-1)!.y > BOARD.H / 2);
});

test('suggest picks the median-scoring playable word, not the best', () => {
  const s = withRack(['C', 'A', 'T', 'S', 'Z', 'E', 'D']);
  const sug = suggestWord(s)!;
  assert.ok(sug && isWord(sug.word));
  const res = submitWord(s, sug.selection);
  assert.ok(res.ok);
  assert.equal(res.ok && res.word.score, sug.score);
  const scores = findWords(s.rack.map((t) => t.letter), 3, 500)
    .map((w) => scoreWord([...w].map((letter) => ({ letter, blank: false })))).sort((a, b) => a - b);
  assert.ok(sug.score < scores.at(-1)!, 'not the top-scoring word');
  assert.equal(sug.score, scores[Math.floor((scores.length - 1) / 2)]);
  assert.equal(suggestWord(withRack(['Q', 'X', 'Z'])), null);
});

test('suggestions use real tiles before blanks', () => {
  const s = withRack(['C', BLANK, 'T', 'A']);
  const sel = selectionFor(s, 'CAT')!;
  assert.ok(sel.every((x) => x.as === undefined));
});

test('pass-through collects up to 8 letters', () => {
  assert.equal(BALL_CONFIGS.pass.maxCollect, 8);
});

test('scoreFromLetters spends real tiles before blanks', () => {
  assert.equal(scoreFromLetters('CAT', ['C', 'A', 'T']), 5);
  assert.equal(scoreFromLetters('CAT', ['?', 'A', 'T']), 2);
  assert.equal(scoreFromLetters('CAT', ['C', 'A', 'T', '?']), 5);
  assert.equal(scoreFromLetters('CAT', ['A', 'T']), null);
});

test('bestWordFrom returns the top-scoring word, not just the longest', () => {
  const best = bestWordFrom(['Q', 'I', 'A', 'T', 'E'], 3)!;
  assert.ok(best);
  for (const w of findWords(['Q', 'I', 'A', 'T', 'E'], 3)) {
    assert.ok(scoreFromLetters(w, ['Q', 'I', 'A', 'T', 'E'])! <= best.score, w);
  }
  assert.equal(bestWordFrom(['Q', 'X', 'Z'], 3), null);
});

test('drops record rack history and the end-of-game best word', () => {
  let s = createSession('history-seed', 'practice', '2026-10-09');
  const { session } = applyDrop(s, { x: BOARD.W / 2, y: BOARD.launchY, angle: Math.PI / 2, force: 'L', type: 'normal' });
  s = session;
  assert.deepEqual(s.rackHistory, [s.rack.map((t) => t.letter)]);
  const expected = bestWordFrom(s.rackHistory![0], s.rules.minWordLength);
  const best = bestPossible(s);
  assert.equal(best?.word, expected?.word);
  if (best) {
    assert.equal(best.drop, 1);
    assert.equal(best.found, false);
  }
  assert.equal(bestPossible({ ...s, rackHistory: undefined }), null);
});