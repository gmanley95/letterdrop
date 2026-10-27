/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import { BALL_TYPES } from '../src/engine/ballConfig';
import { findWords } from '../src/engine/dictionary';
import { RULES_VERSION } from '../src/engine/rules';
import { createSession, previewShot } from '../src/engine/session';

const seeds = 100;
const results = BALL_TYPES.map((type) => {
  let letters = 0;
  let words = 0;
  let playable = 0;
  for (let i = 0; i < seeds; i++) {
    const s = createSession(`density-${i}`, 'practice', '2026-10-12');
    let best: number[] = [];
    for (const x of [50, 115, 180, 245, 310]) {
      for (const angle of [1.2, Math.PI / 2, 1.94]) {
        const hits = previewShot(s, { x, angle, force: 'M', type }).hits.map((h) => h.pegIndex);
        if (hits.length > best.length) best = hits;
      }
    }
    const rack = best.map((j) => {
      const letter = s.pegs[j].letter;
      if (letter === null) throw new Error('Opening board contains an empty letter slot');
      return letter;
    });
    const choices = findWords(rack, s.rules.minWordLength).length;
    letters += best.length;
    words += choices;
    playable += Number(choices > 0);
  }
  return { type, meanLetters: letters / seeds, meanWordChoices: words / seeds, playablePct: playable };
});

const report = {
  rulesVersion: RULES_VERSION,
  seeds,
  simulatedOpeningShots: seeds * BALL_TYPES.length * 15,
  policy: 'Best letter-count opening shot among 15 medium-force aims; ties keep the first shot.',
  scope: 'Opening-drop comparison only, not a full five-drop daily balance audit.',
  before: [
    { type: 'normal', meanLetters: 7.88, meanWordChoices: 498.4, playablePct: 99 },
    { type: 'precision', meanLetters: 5.75, meanWordChoices: 131.98, playablePct: 97 },
    { type: 'pass', meanLetters: 4, meanWordChoices: 13.08, playablePct: 85 },
  ],
  after: results,
};
writeFileSync('docs/board-density-results.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
