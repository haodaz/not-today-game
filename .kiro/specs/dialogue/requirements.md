# dialogue — requirements (author 2026-11-01: "the text box is not a game yet")

One dialogue system for everything spoken in the 3D/room views: narration, inner voice, sounds, speakers at the door/gap/desk, choices, and Kuro's chat. Replaces the ad-hoc box from day-loop FR2 and the chat-in-a-window from kuro-chat FR1; everything else in those specs stands (line kinds, sequences, turns, memory, offline answers, judgement).

## FR1. The box
- Fixed size, bottom-centre, about 62 % of the stage width and three text lines tall (never grows). Translucent warm grey, 1 px hairline, 6 px radius; body text 18 px (zh) / 17 px (en), line height 1.6; text types in (polish timing). A name tag sits on the box's top-left edge, overlapping it (small plate, uppercase tracking for en): 门外 / 缝里 / 桌上 / 克总 / the player's name.
- Text longer than three lines is paged: a small ▼ pulses bottom-right; click/space shows the next page; the last page's ▼ becomes ▶ to advance. Never scroll inside the box.
- Choices render inside the same box as a vertical list replacing the text (max 4; longer lists page too), with a ◆ marker on hover/selected; a choice's text is at most two lines.
- `inner` lines are italic and have no tag; `sfx` lines are short, centred, no tag.
- History: a small `↺` chip on the box's top-right opens a scrolling log of this day's dialogue (every line and the player's choices, tagged), full height, click outside or Esc closes. It is per day; cleared on lie-down. Strings `dialogue.history`, `dialogue.close`.

## FR2. Talking to Kuro is an NPC conversation
- Clicking Kuro's HUD body (day-loop Correction 2026-11-01) does **not** open a window. The HUD body hides and the box appears with tag 克总 and the line `要和克总聊聊吗？`, then two choices: `聊聊` / `先不聊` (`kuro.ask`, `kuro.yes`, `kuro.notNow`). `先不聊` closes and the body returns.
- In the conversation Kuro's lines use the box with its avatar (`public/kuro/k3d_base.png`, 56 px, round) in the tag position and its name beside it. The player's turn is a second box of the same size, rising from the right edge of the stage, tagged with the player's name: it holds the day's starter questions as choices (`content/kuro-days`) plus one last line `说点别的…` that turns into a single-line text input inside the box (Enter sends). Five turns per day as before; the sixth attempt shows the bedtime line in Kuro's box and the player box does not appear again.
- During work beats (turns do not count) the same flow runs but Kuro answers with the day's constant line and the player box offers only `好。` to close.
- Kuro's small desktop window (desktop-ui FR5) remains as a status pill on the desktop (last line, online/night dot, 今天 n/5) and no longer takes input; clicking it is the same as clicking the HUD body.
- Leaving the conversation: `先不聊` at any player turn, or Esc; the body returns to the HUD corner (320 ms back along the same path).

## FR3. Tests
- Snapshot: a narration line, a paged line (2 pages), choices, the Kuro prompt, a Kuro line with avatar, the player box with questions, the player box with input open, history open.
- Property: box height constant across every snapshot; no line exceeds three visual lines at the given width (measure with happy-dom + a monospace fallback width table); the sixth turn never renders the player box.

## Correction 2026-11-01 (author): Kuro stands at the box's right end, not on the tag
56 px on the tag reads as an icon. Kuro's face leaves the tag. When Kuro speaks, its **portrait stands at the right end of the dialogue box**: feet on the box's bottom edge, inside the box's right edge, and the head rising **above the box's top edge** (portrait about 200 px tall against the 132 px box; the current state's sprite frame, so it still blinks). The text column takes everything left of the portrait, so it gets wider than today, not narrower. The tag then carries only the name KURO. The player's box (rising from the right) keeps clear of the portrait: it sits below/left of it or the portrait steps aside while the player's box is up, Kiro decides and says which. Narration tags (门外 / 缝里 / 桌上) do not change. Update design/chrome/dialogue.html's numbers in the design doc and the dialogue snapshots after checking the diff.

## Correction 2026-11-01 (author): the ↺ history button sits beside the name tag
The ↺ (今日对话) button is no longer a loose circle at the box's top-right. It sits on the tag strip, immediately right of the name tag (KURO / 门外 / 缝里 / 桌上), same height as the tag, small, and when there is no tag it sits alone at the tag's position. Same action and label as before.

## Addition 2026-11-01 (author): the player's own portrait for inner lines
`inner` lines (the me-voice, italic) show the **player's portrait** at the box's right end, exactly where Kuro's portrait stands for Kuro's lines: same size (about 200 px tall, head above the box's top edge), same slot, never both at once. The portrait is a faceless visual-novel bust whose face is hidden by hair: `public/player/she.png`, `he.png`, `none.png`, chosen by the title card's pronoun answer (她 / 他 / 不说). It is a still image, no animation. Narration (plain) and speaker lines keep no portrait. The tag for inner lines stays empty (no name).
- **Dreams use the child.** On dream nights (stages.json `dreamNights`), inner lines show the child version instead: `public/player/she_kid.png`, `he_kid.png`, `none_kid.png` (same pronoun mapping, same slot and size). Other NPC portraits (teachers and so on) come later, one at a time, as content decides.

## Addition 2026-11-01 (author): NPC portraits on speaker lines
Speaker lines whose `who` is an id in `content/npc.json` show that NPC's **portrait** at the box's right end: the same slot and size as Kuro's and the player's (about 200 px tall, head above the box's top edge), still image, never two portraits at once. The tag carries the NPC's name from the strings key in `npc.json` (`msgs.boss` → 老板, `msgs.teacher` → 老师). Speakers not in `npc.json` (`寻呼机`, `屏幕`, `缝里`, `输入框`, `member`) keep today's tag-only rendering. `content/npc.json` is loaded by a strict loader like every other content file; the day files now use ids (`teacher`, `laozhou`, `xiaozhang`) where they used names. Assets: `public/npc/<id>.png` (cut out, white-keyed, like `public/player/*`). Add a snapshot: a `teacher` line on day 5's dream with the portrait, and a `寻呼机` line without one.

## Addition 2026-11-02 (author): a line waits for its place
The author, after playing: "点了就继续说" — standing at the desk you can click through a whole day's lines, including ones about what is on the screen (老板说…, 更新日志, 群里一张图) before you have entered the screen. Lines belong to places. Content now says where; the box does the waiting.

- Any `say` line in `content/days/day-NN.json` (beats, `onUnlock`, `onDone`) may carry `where`: one of `room`, `desk`, `door`, `night`, `screen`, `screen:msgs`, `screen:workbench`, `screen:browser`. A sequence (`say` array's parent) may carry `where` too, as the default for its lines. The strict loader accepts these and rejects any other value.
- **No `where` = play where the trigger happened**, i.e. today's behaviour. The `night` beat is always `night`; `shutdown` choices (night-hand) always play in the room as they do now; nothing already working changes.
- A queued line whose `where` does not match the current view **waits**: the box closes at the end of the previous line (or does not open), and the line plays as soon as the player is in that place. Order is kept inside a sequence: line 2 cannot play before line 1. Across sequences, the first sequence whose next line matches the current view plays; the others keep waiting in queue order.
- Matching: `screen` matches any desktop app; `screen:msgs` matches the desktop with that app in front (either monitor); `desk` matches the tabletop view; `room` the room view; `door` the door view; `night` the bed/night view. The Kuro chat overlay does not change the view.
- Waiting lines are dropped at `lieDown` (never leak into the next day) and are **not** events: `state = f(day) ⊕ replay(events)` is untouched. Session-only, like the rest of the dialogue queue.
- A first-time pointer is not needed: the checklist already tells the player where to go.
- Tests: loader accepts/rejects `where`; a sequence with lines `[desk, screen:msgs, room]` plays exactly one line per view in that order while the player moves desk → screen(msgs) → room; a `screen:msgs` line does not play in screen(workbench); lines left at lieDown are gone next morning; snapshot day 7 boot (room lines first, the 老板 line only after entering the screen).

Claude annotates the eighteen day files from content (done 2026-11-02 in the same commit as this addition); Kiro does not edit `content/`.

## Addition 2026-11-02 (author): a line can bring its own backdrop
Dreams and flashbacks need pictures of their own (the author: "所有梦、回顾叙事不太好穿起来"). A `say` line may carry `backdrop`: a path under `public/room/dream/` (strict loader: a string starting with `/room/dream/`). While that line is on show, the stage behind the box crossfades (1.2 s) from the current still to that photo, full-frame, under the HUD, with the collapse shader off; the next line without `backdrop` keeps the photo until the sequence ends, then the stage fades back (1.2 s) to the normal still. The existing day-11 office rule (late-days addition) becomes a case of this. Photos now in place: `office.jpg` (the last day, empty), `office_busy.jpg` (the good years), `office_half.jpg` (half the desks gone), `office_night.jpg` (late, two people left), `classroom.jpg` (1997), `exam.jpg` (the 96). Claude annotates the dream nights (5, 11, 15) and the flashback lines in content. Tests: loader accepts/rejects; snapshot the stage with a backdrop line on show and after the sequence; property: no backdrop stage outside a sequence.
