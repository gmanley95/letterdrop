# Product decisions

| # | Decision | Why | Revisit if |
|---|---|---|---|
| 1 | Expo React Native + TypeScript | One codebase for iPhone and Android, runs in Expo Go, web build for desktop testing | Need native-only physics performance |
| 2 | Engine is React-free TS in `src/engine/` | Deterministic, unit-testable in Node, reused by simulation | — |
| 3 | Custom deterministic fixed-step physics (dt 1/120) instead of a physics library | Daily puzzle must replay identically on every device; previews must match the real drop | Players report cross-device differences |
| 4 | State-based navigation in `App.tsx`, no Expo Router | Six screens, no deep links needed; fewer dependencies on an RC React Native | Deep links or web URLs are needed |
| 5 | Local sign-in (guest or name), AsyncStorage | User chose it; no backend or privacy burden | Cloud sync or leaderboards are added |
| 6 | Turn flow: drop → one word or skip → next drop | User chose it; keeps 5 drops ↔ 5 words aligned | Playtests show too few words |
| 7 | Precision = low bounce, Medium force only, preview through at most three bounces | User-directed force lock and bounded trajectory preview | User changes the precision rules |
| 8 | Pass-through cap of 8 letters (raised from 4 by user request) | Without a cap a straight vertical drop could sweep a whole column | Simulation shows it dominates or is useless |
| 8a | Plain (letterless) pegs between letter balls | User: pass-through "bounces off pegs" but not "the letter balls"; separate plain pegs make both true | User wants pass-through to bounce off every peg |
| 8b | Aim limited to ±50° from straight down | User asked to restrict the drop angle; stops near-horizontal wall shots | Playtests feel too narrow or too wide |
| 9 | Plain Scrabble scoring, no multipliers | User requirement; transparent | — |
| 10 | Rack capacity 10; unused tiles return to the board each turn | User requires recollection, rather than carrying unused letters into the next drop. If no word can be formed, all collected letters are destroyed and refilled from the tray, and the drop counts | User changes turn flow |
| 11 | Letter generator guarantees ≥ 2 vowels or blanks per 5 letters, ≤ 1 of J/Q/X/Z, Q paired with U | Avoids unplayable racks | Simulation shows "no word" rate is still high |
| 12 | Blank chance 5%, with at least one guaranteed on each opening board | User requires every new board to have a wildcard | — |
| 13 | ENABLE word list, 3–10 letters | Public domain, Scrabble-like coverage | Need a curated or profanity-filtered list |
| 14 | Share text shows word lengths and scores, not letters | Spoiler-free like Wordle | — |
| 15 | `.npmrc legacy-peer-deps=true` | Expo SDK 58 template ships RN 0.88.0-rc.3 with strict peer ranges | RN stable release |
