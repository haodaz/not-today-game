# Who does what: the author, Kiro, Claude (for the Kiroween write-up)

NOT TODAY is built by three hands. Keeping the roles distinct is part of the method, and the
hackathon asks for it.

## The author (好大壮)
Story, rules, taste. She plays the build, says what is wrong in Chinese, decides every design
question (what a day is about, what a task feels like, what Kuro may and may not say). Nothing
ships that she has not seen or asked for.

## Kiro
Implementation from written specs, in English. Every piece of work Kiro does starts from a spec
under `.kiro/specs/<name>/requirements.md` (requirements, acceptance, out of scope), with the
project's steering in `.kiro/steering/` and the on-save hooks in `.kiro/hooks/` (content
validation, state tests, missing-English check). Kiro writes code and tests against those specs,
runs `npm run -s validate`, `npx tsc --noEmit -p .` and `npx vitest run`, and commits in English.
Kiro never invents story or lines: text comes from content files written by the author and Claude.

Specs Kiro has implemented or been handed (see each spec's folder for the acceptance):
- desktop-ui, day-loop, delivery, dialogue, guidance, ide, meeting, late-days, lying-view,
  object-bar, object-drawer, object-tutor, object-upgrade, objects-in-hand, kuro-chat, night-hand,
  gates, first-use-hints, camera, camera-viewfinder, collapse-early, collapse-details, blind-box,
  box-arrival, day-graph, desk-prints, lock-by-device, backend, shell, tune, … (the folders under
  `.kiro/specs/`).
- Handed 2026-11-12: `chick-raising` (the chick's stats, ten cares a day, the status screen),
  `no-contract-task` (the contract clause compare leaves the game; the test specimen).

## Claude (Claude Code, Fable 5.1)
Design and content with the author, in conversation: the day structure, the mechanics' rules, the
Chinese lines and their English twins, the Kuro dialogue pools, the replay driver that plays the
game headlessly, the audits of old content against new rules, and the Kiro specs themselves.
Claude also builds the pieces that are tangled with content and judgement (day 1's compare board,
the launch pages, the playtest fixes), and leaves Kiro the pieces that are mechanical once specified.

## The rule between them
A mechanism change ships with its clean-up list (steering, specs, content, code, notes, memory):
whoever changes a mechanism removes the old one everywhere. Claude writes the spec; Kiro builds it;
the author plays it; what she says goes back into the next spec.

## 2026-11-12 — work-stages-polish (handed to Kiro)

Claude built the full-stage work screens (compare, tune, clue, meeting, the 2048 approval chain) and
their content; Kiro takes the polish that is pure implementation: the settlement sheet for the clue
and meeting stages, pointer drag of clippings onto slots, swipe + slide animation + the approval
moment on the chain. Spec: `.kiro/specs/work-stages-polish/requirements.md`. Content stays Claude's.

## 2026-11-13 batch (written 11-12 night, for the refreshed credits)

| spec | what | why Kiro |
|---|---|---|
| `old-folder-egg` | the 旧工作 folder in 文件: Labrador drafts (content `files-egg.json`, stills in `public/egg/labrador/`), opened once → black beat → gone | mechanism + view + test, no words |
| `settle-polish` | approval-flow stamps come down one by one, the page's ground while the iframe loads, narrow stage stacking | CSS/markup polish on a finished design |
| `replay-driver-day2` | shot folder auto-created; tasks before pickup; the 回小张 step verified by its event | tooling |

Claude reviews, commits, and replays day 2 / day 13 after.
