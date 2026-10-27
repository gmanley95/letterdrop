# Requirements audit

Status key: ✅ pass (implemented and verified) · 🟡 partial (implemented, not fully verified) · ❌ fail / not done

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | iPhone or Android app | 🟡 | Expo RN, one codebase for both. Web preview runs; native device/emulator testing remains outstanding. |
| 2 | Wordle-like design approach | 🟡 | Flat white/near-black UI, serif wordmark, square tiles, green/gold states. Not visually reviewed in a running build. |
| 3 | Sign-in screen | ✅ | `SignInScreen`: name + Continue, Play as guest, stored on device. |
| 4 | Navigation to app screen and settings | ✅ | Home → Daily, Practice, How to play, Settings; Android back handled. |
| 5 | Game area like the sketch: tray on top, launch zone above dotted line, pegs below | ✅ | `Board.tsx` + `physics.ts` BOARD constants. |
| 6 | 5 balls dropped per game | ✅ | test: "game ends after 5 drops". |
| 7 | Tap ball, 2D launch movement, aim path, draggable S/M/L energy | ✅ | Browser checks moved launch from (180,74) to approximately (235,90), tapped Small, dragged energy to Large, and observed corresponding state updates. |
| 8 | Normal, precision, pass-through balls with different bounce | ✅ | `ballConfig.ts`; physics tests. |
| 9 | Pass-through bounces off walls and pegs, not letter balls | ✅ | tests: ghosts through a letter ball (still collects), bounces off plain pegs, bumpers, empty slots and walls. |
| 9a | Aim angle restricted | ✅ | `clampAngle` limits aim to ±50° from straight down; test covers the clamp; board shows cone guides. |
| 9b | Precision locked to Medium with at most three preview bounces | ✅ | Engine force-equivalence, recorded-force and third-bounce preview tests pass; browser confirms Medium state and disabled Small/Large. Aim-assist cannot override precision preview limit. |
| 9c | Bottom dotted crossing line | ✅ | Board renders `BOARD.exitY`; physics termination test covers crossing that same boundary. |
| 10 | Tray holds 10–12 visible balls | ✅ | 12 visible of 40 queued. |
| 11 | Used letters refilled from tray in activation order | ✅ | test: "refill uses the tray in activation order". |
| 11a | Queued balls tumble into used slots | ✅ | Browser submission of KITE captured queued I/R/G/C in rotating flights, disabled Refilling button, cleared rack and restored 32 board letters after completion. Motion tests verify original starts and exact destination positions. |
| 11b | Unused letters return and must be rehit | ✅ | Tests cover Submit, Skip, final turn, invalid submit, clearing collected flags and rehit vs miss on the next drop. |
| 12 | Collect letters → form words | ✅ | session tests. |
| 13 | Scrabble letter scoring | ✅ | scoring tests; no bonuses. |
| 14 | `?` blank balls, user picks the letter, at least one on every opening board | ✅ | A–Z picker; blank scores 0. Guarantee tested across 1,000 seeds with both default and zero random blank chance. |
| 15 | Share score = top 3 of 5 words | ✅ | test: share score 56 from five words. |
| 16 | Tell the user if no words can be formed | ✅ | In-game notice + results empty state; `hasAnyWord`. Rack is destroyed and refilled from the tray (`destroyRack`), drop counts. |
| 17 | Post-design check: enough words per day, range of scores | ❌ | Simulator written; **not run** (blocked). See GAME_BALANCE_REPORT.md. |
| 18 | Runnable in VS Code / VS 2022 | 🟡 | `.vscode` tasks, launch and extensions + README steps. Not exercised by me. |
| 19 | Practice mode | ✅ | Random seed, no streak impact. |
| 20 | Human playtesting | ❌ | Not performed. |

## Known risks
- Latest validation: typecheck and lint pass; 31 engine and refill-motion tests pass. Mobile-width browser has no horizontal overflow. Native touch/device testing remains outstanding.
- Final-word navigation and reduced-motion bypass are implemented, but the final-turn browser check was interrupted by the browser context closing; final-turn engine state is covered by tests.
- React Native 0.88 is a release candidate; peer conflicts are bypassed with legacy-peer-deps.
- The opening-drop density comparison is measured, but a full five-drop audit under the latest return-unused-letter rules remains outstanding.
- Haptics and Share run on the native path only; the web uses clipboard.
