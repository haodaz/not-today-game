# Collapse early: the first wrong face on day 4, and on days without a meeting (author 2026-11-06)

Why. stages.json: days 4–6 are the `screen` ring (the client and the group replaced), but nothing on the screen changes mechanically until the first meeting on day 7 (collapse-details R2, `FACE_FROM_STAGE = 3`). The author wants the spread to start where the player stares first: the screen, day 4. The hexagram stays at stage 4 (day 10).

## R1 · The face from stage 1
- `FACE_FROM_STAGE` becomes `1` (day 4). The hexagram (`HEX_FROM_STAGE = 4`) is unchanged. Meetings on stage 1–2 days now carry R2's face; the rest of collapse-details is as it is.

## R2 · A wrong face outside meetings
Days 4–6 have no meeting, so the face must happen in the message apps:
- **Where**: an NPC avatar in the conversation list or in a bubble (`avImg`, `messages/view.ts`), or a video card's cover (`cards.ts`, `c-video`) when the conversation has one today. Never the player's own square, never a silhouette alias, never the parents' or the clan group (home stays home until day 16).
- **When**: once per day per app (喂信 and 汀汀 count separately), 2–6 s after that app's window is first opened that day (seeded: run id + day + app; `jitter`), only while the window is on screen. 900 ms (`FACE_MS`), then back. Session only; no event.
- **Which**: a seeded pick among the avatars on screen at that moment (the conversation list's rows, the open conversation's bubbles, a video cover); none visible → skipped for that app today.
- **Look**: the same wrong face a meeting draws (collapse-details R2's treatment), applied to that `<img>`; a video cover gets it on the cover image.
- On stage ≥ 3 days this also runs (it is one more thing that goes wrong), but never at the same moment as a meeting's face (if a meeting window is open, skip).

## R3 · Tests
- `FACE_FROM_STAGE` is 1; `collapseLines` on a day-4 meeting fixture yields a face line and no hex line.
- The message-app face: fixture with 汀汀 open on day 4 → exactly one avatar wrong at the seeded time, back after 900 ms; day 3 → none; the parents' group → never; the same seed → the same pick (replay-stable).
- Existing collapse-details tests updated for the new stage threshold; list any snapshot that changes.
