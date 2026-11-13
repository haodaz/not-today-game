# The five endings' pages (author 2026-11-13, her second pass)

The ending **rules, the state model and every line of text are already in** (Claude, commit after
674f76c): `src/state/endings.ts` decides the ending and its flavour; `content/strings/{zh,en}.json`
carry every caption and line (keys below). **This spec is the pages**: the flow between them, the
markup, the CSS, the tests. Do not change the rules in `src/state/endings.ts`, and do not write or
edit any text — a missing string is a question for Claude, not a string to invent.

| # | name (`ending.name.*`) | kind / flavour | how it is reached | after the fight |
|---|---|---|---|---|
| 0 | 温柔的世界 | `collapse` | SAN 0 on any day (never reaches day 18, no fight) | white → one line → credits → **the fake day 1** → lines → title |
| 1 | 以我之名 | `bad` | assimilation at max at day 18's lie-down; the strong fight, no Q-Kuro | **the waking** → 你和你 → credits → lines → title |
| 2 | 回到未来（或许是最后一次） | `survive`, flavour `warm` (affinity ≥ threshold) | day 18's lie-down, not good; Q-Kuro fought | credits → lines → 第一日 → new run |
| 3 | 回到未来 | `survive`, flavour `cold` | as 2 with low affinity; the hard fight | credits → lines → 第一日 → new run |
| 4 | 导盲犬小克 | `good` | survive + hand + all recognised + affinity + assimilation ≤ 40 + **no object upgraded** | credits → lines → day 19 |

Helpers already exported from `@state/endings`: `endingFlavour(ending, state)` → `"collapse" | "bad" |
"survive.warm" | "survive.cold" | "good"`, `surviveFlavour(state)`, `affinityHigh(state)`,
`noneUpgraded(state)`. `lastLineKey(ending, state)` in `src/world/endings/credits.ts` already picks
`credits.last.survive.warm` / `.cold`.

## What changes in the flow (`src/world/endings/flow.ts`, `view.ts`, `src/world/desktop/model.ts`)

`session.endingPage.phase` gains three phases: `"tender"` (the fake day 1), `"wake"` (the waking),
`"lines"` (the player–Kuro lines). The order per ending, each step one click (`ending-next`), in
place of today's `firstPage` / `endingNext` tables:

- **collapse**: `collapse` (as today: run-to-white, then `ending.collapse.line`) → `credits` →
  `tender` → `lines` → host `afterBad()` (the title, run cleared).
- **bad**: the fight ends (`boss-done`) → `wake` → `you` (你和你, as today) → `credits` → `lines` →
  host `afterBad()`.
- **survive** (both flavours): `credits` → `lines` → `after` (第一日, as today) → host `newRun()`.
- **good**: `credits` → `lines` → `after` (day 19, as today; it stays).

The credits keep their rule: the first click shows the whole roll, the next click moves on. The
song keeps playing from the credits through `tender` / `lines` / `after` (`src/world/sound/plan.ts`:
the `when === "credits"` branch covers `endingPage.phase` in `credits | tender | lines | after`).

## The three new pages (`src/world/endings/view.ts`, CSS in `src/world/room/room.css`)

**`tender` — the fake day 1 (collapse only).** The day-1 room, bright: `public/room/shots/room.jpg`
full-stage, with a soft white vignette (the page is the lightest thing in the game — one colour
tone, no dark areas). Four captions `ending.tender.1` … `.4`, one per click (the first shows at
once; a click adds the next; the click after the fourth moves on). Captions in the plain narration
style of the room's dialogue box (`.dlg`), centred low. Class `tender-page`, `data-step="1..4"`.

**`wake` — the waking (bad only).** `public/room/photos/d06_bed.jpg` full-stage (the wall with the
painting of you lying in the bed; it is a 1024 × 1024 photo — cover the 1600 × 900 stage, centred,
with a dark letterbox where it does not reach). Three captions `ending.wake.1` … `.3` as above, then
on the fourth step the whole page darkens and `ending.wake.say` (早上好) shows alone, large, in the
player's own text colour — you say it. Class `wake-page`, `data-step="1..4"`; step 4 adds `said`.

**`lines` — the player and Kuro (every ending).** Black page. The pairs `ending.lines.<flavour>.<n>.you`
and `ending.lines.<flavour>.<n>.kuro` for n = 1, 2, 3 … until neither key exists (`hasString`);
a pair may have only `.kuro`. One click shows the next line (you, then Kuro, then the next pair).
`{day}` in a line is the day the run ended (`state.day`). Layout: the lines stack upward like the
credits, Kuro's with its small portrait (`/battle/q-kuro.png` for `good` and `survive.warm`; the
plain dark avatar used by the chat window elsewhere for `survive.cold`, `bad`, `collapse` — reuse
whatever the Kuro chat shows, do not add art), yours plain. After the last line, one more click
shows the ending's name card: `ending.name.label` small over `ending.name.<flavour>` large,
centred; the click after that leaves the page (the host call or `after`). Class `lines-page`,
`data-flavour="<flavour>"`, each line `.ln.you` / `.ln.kuro`, the card `.ending-card`.

Every page is one click target (`ending-hit`, as today). Reduced motion: no fades.

## The title's collection (`src/ui/title/*`, `src/ui/collection.ts`)
The figure names are already renamed in strings (`title.fig.*`). Nothing else changes there now:
the profile keeps counting `bad / survive / good / collapse` (the flavour is not recorded).

## Dev route (`src/main.ts`)
`?day=18&boss=bad|survive|good` already starts the fight. Add `&endpage=tender|wake|lines` to jump
straight to that page of the ending the `boss=` param names (`collapse` for `tender`), so each page
can be looked at without playing — same place the `boss=` param is read.

## Tests (`tests/endings.test.ts` "the pages" case, `tests/pullout.test.ts`, a new `tests/ending-pages.test.ts`)
- The phase order per ending exactly as the table above, driven by `endingNext`; `afterBad` /
  `newRun` called once, only at the end.
- `tender`: four steps, the captions in order, the page carries `tender-page` and the step.
- `wake`: three captions then `said` with `ending.wake.say`; the photo path is `d06_bed.jpg`.
- `lines`: for each flavour the pairs render in order; a pair without `.you` renders Kuro alone;
  `{day}` filled; the name card after the last line; `survive` picks `warm` / `cold` from affinity.
- The sound plan returns the credits music for `tender` / `lines` too.
- Snapshots for one page of each kind (zh).
- The replay driver (`script/tools/auto-day-shoot.mjs`, day 18) clicks through the new pages; its
  frame names follow the page classes.

## Not in this spec
Kuro's attitude inside the fight (its lines there are the fight's own), the title's ending gallery
art, the song's timing. Ask before touching anything in `content/`.
