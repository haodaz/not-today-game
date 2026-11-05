# voice-babble — requirements (2026-11-05, from the author 2026-10-17 + script/tools/animalese.py)

A voice note in 汀汀 / 喂信 can be clicked and plays an Animalese-style babble: one short formant-filtered syllable per character, no words, never a clear reading. Early days light and quick, each day lower and slower, hiss mixed in from day 16, only hiss on day 18. Never autoplays. Kuro has no voice. Synthesised live with Web Audio; no audio files.

## R1. Content: `content/voice.json` (Claude's, already written)
`{ _note, days: { "1".."18": { baseHz, syllable, gap, hiss } }, pitch: { speakerId: number }, vowels: [[f1,f2] × 5], gain, tones: { _note, zh: [[start, end] × 5] } }`.
- Strict loader `src/world/sound/voice-table.ts` (unknown keys fail; all 18 days present; numbers > 0 except hiss in [0,1]). No en twin (it has no text).
- `pitch[who]` multiplies `baseHz`; a speaker not listed is 1.0.

## R2. The plan (pure, tested): `src/world/sound/babble.ts`
`babblePlan(text, sec, who, day, table) → { syllables: { at, dur, hz, f1, f2 }[], hiss, length }`
- Syllable source: the voice note's 转文字 text when it has one; otherwise `round(sec × 4)` placeholder syllables. Punctuation (`，。、！？,.!? ` and newlines) is a pause of `gap × 4`, no syllable.
- Per syllable: `dur = row.syllable`, then `gap` of silence. Vowel = `vowels[codePoint % 5]`. `hz = baseHz × pitch × (1 + r)`, r uniform in [−0.12, 0.12] from a PRNG seeded by a hash of `(text, day, who)`, so the same note always sounds the same.
- Tone (zh build): each syllable gets `tones.zh[hash(codePoint) % 5]`; `hz` glides linearly from `hz × start` to `hz × end` over the syllable (`frequency.linearRampToValueAtTime`). en build: flat, and every third syllable × 1.08. Plan carries `{ hzStart, hzEnd }` instead of `hz`.
- `length` is capped at `sec` seconds (a 41″ note plays at most 41 s); syllables past the cap are dropped.
- Day 18: `hiss = 1` → no syllables, only hiss for `min(sec, 6)` s.

## R3. The player: `src/world/sound/babble-player.ts`, through the existing context in `src/world/sound/player.ts`
- Per syllable: an `OscillatorNode` sawtooth at `hz` with 6 Hz vibrato of ±4% (an LFO into `frequency`), into two `BiquadFilter` bandpass (f1 Q 6, f2 Q 8) summed, into a gain envelope: 12 ms attack, release `max(20 ms, 35% of dur)`.
- Hiss: white noise buffer → one-pole lowpass (BiquadFilter lowpass 1200 Hz) at `hiss`; the syllable bus at `1 − hiss`. Master = `table.gain`, and 0 when `session.muted` (the sound spec's rule).
- Scheduled on the AudioContext clock from `babblePlan`; nothing is computed in the audio thread.

## R4. The bubble
- The voice bubble (`src/world/desktop/messages/view.ts`, `case "voice"`) becomes a button: click plays, click again stops. One babble at a time across both apps; opening another note stops the first. While playing, the six bars animate (height cycles, 120 ms step) and the `″` count runs down.
- Playing logs nothing (it is not a game action) and changes no state; the 转文字 line is unchanged.
- Day 18: the bubble is greyed (opacity 0.45) and still clickable; it plays only hiss.
- No autoplay anywhere, ever.

## R5. Tests
- Loader: rejects an unknown key, a missing day, hiss > 1.
- Plan: same inputs → identical plan; syllable count = non-punctuation characters (until the cap); length ≤ sec; day 3 hz range around 300 × pitch, day 13 around 120; day 18 has no syllables; laozhou is lower than boss on the same day; zh syllables carry the tone contours, en syllables are flat except every third.
- Bubble: click → `playing` state on that bubble; a second click or another bubble stops it; muted → the player is called with gain 0.
