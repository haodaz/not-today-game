# sound — requirements (author 2026-11-02)

The game has had no sound except a few ffmpeg placeholder sfx and the title rain. This spec adds a sound layer. It is content-driven (`content/sound.json`, Claude owns it) and stage-gated like everything else. The rule of the whole game applies: **silence is a sound too**; the later days take sound away rather than adding it.

Three layers, all optional, all off when `session.muted`:

1. **bed** — the room tone. One loop at a time, chosen by day and time of day, crossfaded. Degraded by cycle through a tiny Web Audio graph (not by shipping degraded files).
2. **music** — rare. Only at the moments the table lists (title, the three dream nights, day 14, the endings). Never during ordinary work.
3. **sfx** — the existing one-shots (`src/world/loop/sfx.ts`), unchanged, plus night-beat stingers from the table.

## FR1. The table
- `content/sound.json` is loaded by a strict loader (unknown keys rejected, like `npc.json`). Shape:
  - `beds`: `{ id: { src, gain } }` — loop files under `public/sfx/`.
  - `byRing`: for each ring (`software`, `screen`, `desk`, `wall`, `room`, `door`) the bed ids for `day` and `night`, plus `degrade: { lowpassHz, gain, dropoutsPerMin, dropoutMs: [min,max], humGain }`.
  - `calm`: ring-level override used on `stages.json.calmDaytime.days` (day 10 plays as the first ring, daytime only).
  - `silence`: `{ fromDay, beats: [...] }` — from that day, on those beats the bed stops entirely (fade 2 s) and stays off until the next beat change.
  - `music`: `{ id: { src, gain, loop } }` and `musicAt`: a list of `{ when, id, fadeIn, fadeOut }` where `when` is one of `title`, `dream:5`, `dream:11`, `dream:15`, `tender-day`, `ending:good`, `ending:bad`, `ending:leave` (the ending ids as san-and-endings names them; Kiro maps, says which).
  - `stingers`: `{ nightBeatType: sfxId }` keyed by `stages.json.nightBeat` types (`light`, `text`, `device`, `hand`, `people`, `room`, …). Missing type = no stinger.
- Everything is derived from `(day, beat, view, ring, nightBeatType)`; nothing in the table is hardcoded in code.

## FR2. The plan is a pure function
- `soundPlan(state, session): SoundPlan` in `src/world/sound/plan.ts` returns `{ bed: id|null, degrade, music: id|null, stinger: id|null }`. It reads `stages.json` for ring, calm days, dream nights, night beat type, and the table for the rest. **No audio API in this file**; it is what the tests cover.
- Title page: `bed: "rain"` (the existing `rain-loop.mp3` moves into the table as a bed), `music: title`.
- Daytime (view room/desk/desktop, beat boot…desk): the ring's `day` bed. Night beat: the ring's `night` bed. Dream nights: `night` bed of the ring **plus** the dream music, bed gain halved.
- Day 10 (calm): plan as ring `software` in daytime; night untouched.
- From `silence.fromDay` on `silence.beats`: `bed: null`. The room has gone quiet; that is the point.
- Day 14: `tender-day` music under the `day` bed, both at the table's gains.
- Endings: the matching music, bed off.

## FR3. The player (Web Audio)
- `src/world/sound/player.ts` owns one `AudioContext`, created lazily on the first user gesture that the game already has (title "start", tower power, any click), never at load. Before the gesture the plan is computed but nothing plays; when the context becomes available, the current plan plays from where it should (loops do not need to be sample-accurate).
- Graph per bed: `AudioBufferSourceNode(loop) → BiquadFilter(lowpass, degrade.lowpassHz) → GainNode(degrade.gain × bed.gain) → master`. Plus one hum: a 50 Hz sine (`OscillatorNode`) through its own gain = `degrade.humGain` (0 on early rings). Dropouts: at `dropoutsPerMin` Poisson-ish random times, master gain to 0 for a random `dropoutMs`, back with a 20 ms ramp. Dropouts are the only randomness; seed from `(day, beat)` so a replay sounds the same.
- Bed changes crossfade 2 s (equal-power). Music fades per its entry. Stingers are one-shots through `playSfx`.
- A missing or failed file is silent, never an error (the existing rule). Files are fetched once and cached as buffers.
- `session.muted` → master gain 0 immediately (not context suspend, so unmuting is instant). Persist `muted` in localStorage under the save's key so it survives reload; the title page reads the same flag.
- Tab hidden → bed gain to 0 over 0.5 s; back when visible. Never leave a hum running in a hidden tab.
- No sound while a video or the splat is loading if the browser throttles; nothing to do, just do not throw.

## FR4. What triggers re-planning
- Any state change that moves `(day, beat, view, ring)` or an ending, and title ↔ game transitions. The controller already has `rerender`; call `sound.apply(plan)` from the same place (Kiro picks the exact hook and says which). Applying the same plan twice is a no-op.

## FR5. Settings
- The existing 🔊 toggle in settings is the whole UI. No volume slider in this round.

## FR6. Tests
- Loader: strict, rejects unknown keys and unknown ring/when/beat-type ids, rejects `musicAt.when` not in the allowed set, rejects a bed id used in `byRing` that is not in `beds`.
- `soundPlan` snapshots: days 1, 4, 7, 10 (calm day vs its night), 11 (dream), 13 (silence beat), 14 (tender), 16, 18; title; each ending.
- Properties: no music during any daytime beat except day 14; `bed === null` on every `(day ≥ silence.fromDay, beat ∈ silence.beats)`; degrade params are monotone non-increasing in `lowpassHz` and non-decreasing in `humGain` from ring to ring; the plan is deterministic.
- Player: unit-test with a fake AudioContext (a few dozen lines, not a library): a bed change produces exactly one new source and a 2 s crossfade; mute sets master to 0; hidden tab ramps down; dropouts come from the seed. No real audio in tests.

## Assets
Claude supplies the files under `public/sfx/` (list in `content/sound.json`). Until they exist the game is silent in those slots, which is correct behaviour, so Kiro can build and test this segment with no files present.
