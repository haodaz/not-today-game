# world-prompts — requirements (2026-11-06, the author with game references: Honkai: Star Rail, Skyrim, Fire Emblem, mobile RPGs)

Two changes so the room plays like a game, not an app.

## R1. Room hints become world prompts (replaces first-use-hints' card in the room)
- In the room views (房间, 桌子, 窗 table, 门, 床, 窗) a hint no longer dims the screen, shows a card, or waits for 知道了. Instead:
  - The target glows: a soft outline pulse around its rect (2 px, warm white rgba(255,246,220,.9), 0 0 14px glow), opacity 0.35 → 1 → 0.35 over 1.6 s, ease-in-out, looping.
  - A floating prompt sits 10 px above the target, centred: a 9 px diamond ◆ (the accent colour) then the short label `hint.short.<id>` in 14 px, white text with a 1 px dark text-shadow, on a pill rgba(20,22,28,.55), 6 px × 12 px padding, radius 999 px. On the turn edge the prompt sits beside the edge arrow, vertically centred.
  - It never blocks: no catcher, no dim; every click and key works as without it.
  - It ends when its condition passes (the player did the thing) or when the player clicks the target; then it counts as seen (profile, as now).
- `chickHint` is not a prompt: it plays once as an inner line in the dialogue box (`hint.chickHint`), when its condition first holds and no box is up.
- The long `hint.<id>` lines are no longer shown for room hints.
- The desktop coach marks (onboarding-steps) are unchanged: those are the computer's own UI. The 工作台 typing line (Kuro's pill) is unchanged.
- Settings 新手提示 still turns all of these off. The 500 ms key grace in controller.ts is no longer needed for room prompts (they take no keys); keep it for anything that still takes keys.
- Several prompts may be due at once; show at most one per view, the first in queue order whose target is on screen.

## R2. Dialogue choices on the right (Honkai: Star Rail)
- Whenever the dialogue has choices (story choices, yes / not-now questions, upgrade offers, Kuro's starters and 说点别的…), they render as a vertical list on the right of the stage, not inside the text box:
  - The column: right edge 4 % from the stage's right, width 32 % of the stage (min 280, max 420 px); its bottom edge sits 16 px above the dialogue box's top; rows stack upward in content order (first option on top).
  - Each row: 46 px min height, 14 px horizontal padding, gap 8 px; the dialogue box's own tone (rgba(248,246,241,.94) background, #1d2129 text, 15 px), radius 8 px; a 14 px icon at the left: ◇ for a plain choice, a speech-bubble glyph for Kuro's starters, a pencil for 说点别的….
  - Hover / keyboard focus: background rgba(255,255,255,1), a 3 px accent bar on the left edge, 120 ms. ↑ ↓ move focus, Enter / Space choose, number keys 1–9 choose the nth row.
  - 说点别的… turns into the text field in place (same row, full width of the column) when chosen; Enter sends, Esc returns to the list.
- While choices are up, the dialogue box keeps the speaker's last line, name and portrait; it no longer holds the options. A click on the box does not advance while choices are up (only a row chooses).
- The click-anywhere-advances rule (playtest-1105 R2) stays for plain lines.

## R3. Strings (Claude's, already in the tree): `hint.short.{tower,screen,turn,phone,door,table,box,items,kuro,bed}`.

## R4. Tests
- R1: each room hint renders as glow + prompt with its short label, no layer that blocks clicks; clicking the target or doing the thing ends it and records it seen; chickHint plays as one inner line; desktop coach marks unchanged.
- R2: a choice beat renders its options in the right column (not inside `.dlg`); row order, icons by kind; keys ↑ ↓ Enter and 1–9; 说点别的… opens the field in place; the box does not advance on click while choices are up.
