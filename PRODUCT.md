# Letterdrop: Product

## Register
product

## Platform
ios, android (one codebase: Expo React Native + TypeScript). Web build works for quick desktop testing.

## Users
Casual daily word-game players who like a Wordle-style ritual: one short daily puzzle, a shareable score, no account friction. They play one-handed on a phone, often on the go.

## Product purpose
A daily word game that mixes a physics ball drop with Scrabble-style word building. Each day everyone gets the same board and letter tray. You drop 5 balls, collect the letters they touch, and spell up to 5 words. Your shared score is the sum of your **top 3 words**.

## Core rules
- 5 drops per game. After each drop you may submit one word (3+ letters) or skip. Up to 5 words.
- Three balls: **Normal** (lively bounce), **Precision** (low bounce, locked to Medium, preview through at most three bounces), **Pass-through** (ghosts through letter balls but still collects them; bounces off plain pegs, bumpers, empty slots and walls; max 8 letters). A **Suggest** button fills in a middle-scoring playable word (the median, never the top pick unless it's the only option). Aim is limited to 50° either side of straight down.
- Force: drag the energy control or select Small / Medium / Large; the arrow and preview update together. Precision always uses Medium.
- Move the launch ball in both axes within the zone below the tray and above the dotted line. A bottom dotted line marks where a drop ends.
- Tray at the top shows the next 12 letters. Used slots receive tumbling queued balls in collection order. Unused letters return to their original board spots after Submit or Skip and must be hit again; the rack clears. If no word can be formed, all collected letters are destroyed and refilled from the tray, and the drop counts.
- Every new board starts with at least one `?` ball. Blanks let you pick the letter and score 0 points.
- Scoring is plain Scrabble letter values, no multipliers or hidden bonuses.
- If no word can be formed from your letters, the game says so and lets you continue.

## Evidence
The user's paper sketch: a tray of letter balls at the top (R S T B ? ? ?), a launch zone with the ball above a dotted line, and letter pegs plus a curved corner bumper below. The board layout follows the sketch directly.

## Brand personality
Calm, clean, a little playful. Wordle-like restraint: white or near-black ground, a serif wordmark, square letter tiles, green for "got it", gold for "just lit".

## Design principles
1. The board is the hero; chrome stays quiet.
2. One clear next action at each step (aim → drop → build → submit/skip).
3. Every state is spoken: collected letters, no-word situations and errors are stated in plain words.
4. Tap targets ≥ 44 pt; color is never the only signal (ball types also differ by shape: solid, dotted centre, dashed ring).
5. Respect reduced motion and haptics settings.

## Anti-references
Casino or slot-machine pachinko visuals, neon arcade glow, coin showers, ads, energy timers.
