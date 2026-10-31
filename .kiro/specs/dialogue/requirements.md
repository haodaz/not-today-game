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
