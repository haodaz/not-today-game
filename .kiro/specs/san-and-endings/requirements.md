# san-and-endings — requirements

SAN is the only failure meter and it is never shown. Endings are three exits from the same last night. Nicknames the author and Claude use: bad = 「第一日，改」, survive = 「回到第一日」, good = 「第十九日」.

## FR1. SAN
- Starts at `constants.sanStart`; changes only through content effects (task paths, replies, raids, upgrades, choices) and the daily drift in stages.json if present. Clamp 0..100. Thresholds in `constants.sanThresholds` drive presentation only (reply menu shrink is already stage-driven; SAN bands add: cup colder, room narrower by one step, text texture density). The heart-rate chip (day 9+) maps SAN to bpm: 72 at 100, rising to 110 at 0.
- Reaching 0 at any moment ends the run that night: the bad ending plays at the next shutdown beat (not mid-beat).

## FR2. Three exits (day 18 night and before)
- **Bad**: SAN 0. The small window shows a conversation titled 你和你: "you" replying to everyone with the right word at the right time (built from the run's own log: unchecked tasks become messages "you" sent, the family's 吃饭了吗 answered 好 on time). Then credits (FR3), then the title page with `nt_run` cleared and `nt_profile` kept; the profile gets `runs += 1`.
- **Survive**: day 18, slip filled (`slip_filled`), lie down. Credits, then a page that says 第一日 and starts a new run with nothing carried over.
- **Good**: day 18, `shook_hand` and: all six objects recognised, every raid night blocked, affinity ≥ `affinityThreshold`, `letItDoUnchecked` ≤ constants.goodMaxUnchecked (add, default 3). Credits, then day 19: the room, morning, the door handle turns (room-scene; until then the door still + one dialogue line). The final red-blue line is hand-written by Claude (TBD in content).
- If day 18 ends with neither flag (player lay down without choosing), treat as survive.

## FR3. Credits are Kuro's log
- Roll `judgement.log` in day order, one line per evidence entry: `第 N 天 · what the player did · which way it moved Kuro`, in the plain red/blue style; the last line depends on the ending (content). Built only from stored evidence. Speed: one line per 1.6 s, click to skip to the end, never to skip entirely.

## FR4. Tests
- Property: SAN never leaves 0..100; bad ending fires exactly once per run; good ending requires all five conditions.
- Snapshot: a fixture log rolled as credits; the 你和你 conversation from a fixture run.
