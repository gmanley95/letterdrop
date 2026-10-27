# Letterdrop — Design

**World: "Sunlit tabletop."** A warm paper room around a deep felt game table. The board is a physical object (felt, brass fittings, ivory balls) and everything around it is quiet stationery. Calm and tactile, never casino: no neon, no glow-for-glow's-sake, no coin showers.

## Palette (`src/theme.ts`)
| Role | Light | Dark | Notes |
|---|---|---|---|
| Paper `bg` / `surface` | #F7F0E3 / #FFFBF3 | #141820 / #1E2430 | Screens and cards; a faint marigold wash sits behind every screen header. |
| Ink / muted | #1B2232 / #6A6253 | #F4ECDC / #ABA392 | Navy ink, never pure black. |
| Felt board | #22524B → #0F2E2A | #1B443E → #0A201D | Vertical gradient plus a soft vignette. The board is felt in **both** themes. |
| Ivory letter ball | #FFF9EE → #D9CBB0 | same | Radial-shaded sphere with navy letter. |
| Collected / just hit | #E7A93B amber / #FFD866 marigold | same | Hits get a soft halo; collected balls stay amber until refilled. |
| Brass (bumpers, posts, walls, tray rule) | #D4AE6A → #7A5A26 | same | |
| Primary (terracotta) | #C04A30, edge #8E3320 | #EE7A5E | Main actions, score numbers, drop dots. |
| Balls | Normal #E4573D · Precision #2F6FE0 · Pass #8A5BD8 | brighter variants | Shape still encodes type: solid / white centre dot / dashed ring. |

High contrast swaps collected to #F28C28, hits to #7FC4FF, brightens felt lines and darkens borders.

## Shading
- Every sphere uses one `Sphere` radial gradient (highlight at 34%/28%, base at 35%, dark edge) and a small offset drop shadow (black at 30–35%).
- Tiles and buttons are **letterpress keys**: a light face over a thicker darker bottom edge (`tileEdge`, `primaryDeep`). Selected tiles sink 2px.

## Type
- Display: Georgia/serif (`TITLE_FONT`) for the wordmark ("Letter*drop*" with the italic terracotta tail), screen titles, stats and the results score.
- UI: system sans, weights 700–800 for letters and labels; uppercase tracked micro-labels for stats and kickers.

## Shape
- Pills (radius 26) for buttons; 20–24 radius cards; 8px tile corners; circular 44px icon buttons.

## Motion (all off under Settings → Reduced motion)
- `FadeIn`: 420ms ease-out-cubic fade + 14px lift, staggered 120ms on Home, Sign-in, and Results rows.
- `Button`: spring press sinks 2px and scales to 0.98.
- `PopIn`: freshly collected rack tiles spring from 55%.
- Board: 9-frame fading ball trail; halo on letters lit this drop; the existing tray-to-board tumble refill.
- Results: share score counts up over 900ms.
