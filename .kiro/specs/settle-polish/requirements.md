# Settlement polish — requirements

The settlement page (`src/world/desktop/workbench/settle-layer.ts`, `settleSheet` in
`settle-sheet.ts`, styles `.sl*`, `.st*`, `.af*` in `src/world/desktop/desktop.css`) is one full
screen in two halves: left the game's ending, right the real thing (a page in an iframe, the sheet,
the approval flow). Read `script/notes/work-screens-2026-11-12.md` → "The settlement" first. Pure
views; the actions already exist. Do not edit `content/`; strings you need go to
`content/strings/zh.json` and `en.json` only (same keys in both). Do not run git. Shell:
`npx tsc --noEmit -p . 2>&1 | tail -20` / `npx vitest run 2>&1 | tail -20`, never more than twice.

## 1. The approval flow stamps come down one by one

On the chain day the right half shows `.af` with one `.af-step` per rank and `已批` on every rank
up to the one reached. When the settlement opens, the stamps appear in order from the bottom rank
up, ~90 ms apart (a CSS animation with a per-step delay via a custom property `--i` set in the
markup, `animation: af-stamp 180ms both`; the stamp scales from 1.6 and rotates into its -6deg),
so the form visibly climbs. With `session.reducedMotion` on, no animation (all stamps at once).
`settleSheet` gets the session's `reducedMotion` as a parameter (default false) — pass it from
`clue-stage.ts` / `meeting-stage.ts`. Test: the markup carries `style="--i:<n>"` on each done step,
and the `reduced` class on `.af` when reduced motion is on.

## 2. The page's ground while it loads

The right half of a page / backend settlement (`.sl-page .sl-effect`, `.sl-backend .sl-effect`) is
white until the iframe paints. Give `.sl-effect` the layer's paper ground (`#EFEAE0`) and the iframe
`background: #fff` only once loaded: add the `load` listener in the desktop controller next to the
frame keeper (`src/world/desktop/controller.ts`, where `createFrameKeeper` is wired), which sets
`data-loaded="1"` on a kept iframe when it fires; style `.sl-frame[data-loaded="1"] { background:
#fff }`. The kept iframe keeps the attribute across renders (it is the same node); a new copy starts
without it. No test needed beyond tsc; say in the report how you verified it in the browser if you
did, or that you did not.

## 3. Narrow stage

Under 1100 px of stage width (`.stage` is scaled, so use a container query on `.sl` with
`container-type: inline-size` on the work stage's body, or a `@media` on the viewport if container
queries fight the fit), the two halves stack: the record on top at its natural height (the actions
row stays with it), the real thing under it taking the rest. Nothing is cut off; the sheet and the
approval flow wrap (the flow under the sheet at full width, steps in two columns).

## 4. Out of scope

No changes to the state engine, the actions, or the content. Keep every existing test green
(`tests/sheet-settle.test.ts`, `tests/tune-stage.test.ts`, `tests/compare.test.ts`,
`tests/guidance.test.ts`).
