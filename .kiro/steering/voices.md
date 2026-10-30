---
inclusion: always
---

# Voices — rules for every string the game shows

All text in the game comes from exactly four sources. Each has its own grammar. Never mix them.

1. **Narration** (the player's own inner voice). Second person, present tense, short sentences. Writes only actions and what is seen. No feelings, no adjectives, never names the thing. May carry an attitude: one judgement, one jab, one definition. Example: `You go back to the list. He still hasn't mentioned money.`
2. **The new world.** Kuro speaks English idioms, gentler every day (`Good to see you.` → `I've got your back.` → `Hold the fort.`). The boss, partner and client write real Chinese work messages in stages 0–2 and switch to Kuro's grammar from stage 3, one day behind Kuro. Kuro's rare unwrapped lines (no idiom, no body in them) are rendered with the `plain` style: red and blue ghosts offset on the same line.
3. **Objects.** Each outputs only what its channel allows. Pager: digits only (later, in dream state, a page of pictures). Chick: one of an enumerated set of 32×16 frames. Calculator: seven-segment digits and the letters they can form upside down. Dictionary: English in, Chinese out, one word at a time. Tape: a transcript of sound.
4. **The child** (the player in 1997). Only digits on the pager, and half a sentence on the tape. All of it is hand-written constant data.

A fifth channel exists in the script data: **inner voice** (first person, one short line per beat, italic in the UI, never sent). It is data from `content/`, not generated.

## Hard rules

- Never print the name of the thing. Kuro is the assistant's name, not its. Refer to it as "it", "that", or a cut-out blank.
- Code never generates, rewrites or "polishes" these constants: the child's pager messages, the chick's frames, the tape's half sentence, the ending texts, the note that says `today`, the cipher table on the textbook, every line in `content/days/*.json`. Code reads them as data. If a task seems to require writing story text, stop and leave a TODO for Claude.
- Horror comes from format, not vocabulary. Do not write "tentacle", "abyss", "blood" anywhere in the new world's UI. Use timestamps, voice-note durations, forwarded cards, `Read`, greyed-out reply options.
- Kuro's "knows too much" lines may only draw on (a) the player's dreams as stored in `content/`, and (b) live state the game actually has (water poured at, first keystroke at, times lain down). Never on the login inputs (name, nickname). The name is only ever spoken via the name variable.
- Chinese is the source language. Every user-facing string goes through the i18n table (`content/strings/zh.json`, `en.json`). English is a real localisation, written by Claude, never machine-translated. Missing English keys fall back to Chinese and are reported by the strings hook.
- The protagonist has no printed name, gender or body. Name, nickname, what colleagues call you (default 老大 / "boss"), what the boss calls you, and she/he are variables set on the title page. Never hardcode any of them. Never write 他/她 (he/she) for the player or for the child. Art shows at most a hand.
