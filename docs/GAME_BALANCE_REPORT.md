# Game balance report: post-design check

## Status: NOT RUN (simulation blocked in the build environment)

The full-game simulator is written (`scripts/simulate.ts`), but running it was blocked by the build environment's command-permission policy. The full daily balance audit remains unrun. A separate opening-drop density comparison has been measured below. Run the full audit locally:

```bash
npm run simulate -- --rounds 1000 --days 365
```

It writes `docs/balance-results.json`. Paste the key figures into the table below.

## What the simulation checks
| Question | Metric | Target |
|---|---|---|
| Can a good number of words be made per day? | mean words per game, % of games with ≥ 3 words | ≥ 3.0 mean; ≥ 70% of games reach 3 words |
| How often is the player stuck? | % of build steps where no word is possible | ≤ 25% |
| Is there a range of possible scores? | distribution of ⭐ top-3 score (p10 / median / p90), spread across 365 daily seeds | p90 − p10 ≥ 15 points |
| Is each day's board rich? | words formable from board + visible tray letters per daily seed | ≥ 50 words on every day |
| Does any ball dominate? | mean letters and words per ball type and force | no single type wins ≥ 80% of greedy choices |

Policies simulated: random aim, "most letters" per ball type, per force, and a greedy best-score player.

## Measured results
| Metric | Value |
|---|---|
| Rounds | _not run_ |
| Mean words / game | _not run_ |
| Games with ≥ 3 words | _not run_ |
| No-word build steps | _not run_ |
| ⭐ p10 / median / p90 | _not run_ |
| Min board word pool (365 days) | _not run_ |
| Letters per drop: normal / precision / pass | _not run_ |

## Opening-drop density comparison (2026-10-12)

These measurements use rules version 3, before unused-letter returns, the opening blank guarantee and the updated precision/launch controls. They are historical evidence, not a balance certification for the current rules.

The board now has 30 randomly scattered letter balls (best-aim density at 30: normal 9.9 letters / 100% playable; precision 7.3 / 100%; pass-through 7.5 / 97%). Figures that follow were measured with 35 balls (pegR 13, ball radius 6), six random plain pegs and four wall bumpers. `npx tsx scripts\check-board-density.ts` (best of 15 medium aims, 100 seeds): normal 10.0 letters / 1,117 word choices / 100% playable; precision 8.3 / 601 / 99%; pass-through 4.0 / 12 / 86% at the old cap of 4, and 7.9 / 348 / 100% at the new cap of 8. Older figures below are from the 32-ball layout. Across 100 fixed seeds, each ball type samples 15 medium-force aims and keeps the aim collecting the most letters (4,500 simulated opening shots per layout).

| Ball | Mean letters, before / after | Mean dictionary word choices, before / after | Openings with a word, before / after |
|---|---|---|---|
| Normal | 7.88 / 9.98 | 498.40 / 1263.44 | 99% / 100% |
| Precision | 5.75 / 9.58 | 131.98 / 1109.75 | 97% / 100% |
| Pass-through | 4.00 / 4.00 | 13.08 / 19.06 | 85% / 83% |

This measures dictionary choices, not words a human necessarily recognizes or submits. More letters improve normal and precision openings in this sample, but do not guarantee a word for every shot. Pass-through was capped at four letters for these figures; the cap is now eight. This is not the full five-drop balance audit or evidence that all daily puzzles meet the targets above.

Reproduce the current-board measurement with `npx tsx scripts/check-board-density.ts`. The script retains the measured old-layout baseline and writes `docs/board-density-results.json`.

## Engine evidence
- Letter generator guarantees ≥ 2 vowels or blanks in every 5-letter chunk (tested on 2,000 letters).
- Each ball collects a letter at most once; pass-through ghosts through letter balls and bounces off plain pegs, bumpers, empty slots and walls.
- All 30 letter balls and six plain pegs remain inside the playable board, and every gap between letters, pegs and bumpers is wider than the ball diameter plus margin across 1,000 seeds.
- A full rack with no possible word still lets the game progress.
- The earlier precision-settling test described obsolete behavior; current precision requirements are Medium-only force and a preview limited to three bounces.

## Tuning levers if targets miss
`src/engine/rules.ts` (rackCapacity, pegCount, blankChance, minWordLength) and `src/engine/ballConfig.ts` (restitution, caps). Bump `RULES_VERSION` when changing daily rules.
