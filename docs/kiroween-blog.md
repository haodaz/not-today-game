# How NOT TODAY was built with Kiro (draft for the Kiroween blog post)

*Draft, 2026-11-17. For the author to cut and sign. Facts below are from the repository; nothing is claimed that the log does not show.*

## The shape of the work

NOT TODAY is an 18-day desktop horror game made by one person in a rented room, for Kiroween 2026 (Resurrection). The person who made it is not a programmer by trade. The way the work was split:

- **The author** decided everything that matters: the story, the eighteen days, every mechanic, every line's register, every look. She decided by playing, not by reading specs (her rule: "I need a comparison to make a decision").
- **Claude** (Anthropic's Fable 5.1, in the Claude desktop app) turned her decisions into written requirements — one folder per feature under `.kiro/specs/` — wrote all of the game's text and content, reviewed Kiro's code, and committed. Claude never let Kiro touch `content/`, the strings or the script.
- **Kiro** implemented. Each job was one prompt naming a spec and its requirement numbers; Kiro read the spec, built it task by task under `src/` and `tests/`, ran `tsc` and the full `vitest` suite, and reported in English where it departed from the spec and why. 156 of the repository's 789 commits are Kiro's work.

By the deadline there are 83 spec folders. The early ones (October) have Kiro's own `design.md` and `tasks.md`; the later ones are requirements only, because by then the spec format itself had settled into something Kiro could build from directly.

## What the specs look like

A requirements file for this game reads like a letter to a colleague: what the author said (quoted, in Chinese, with the date), what already exists and must not be rebuilt, numbered requirements with the exact names of actions, classes, session fields and events, a test list, and a rules block — never run git, never edit content, report departures. The best ones are short. Example: the "work mode" spec that turned the workbench into a place you enter with one button and cannot leave until the day's work is done was 150 lines; Kiro built it, with its eleven tests, in one session.

The specs changed as the author played. A correction is a dated addition inside the same file ("Author 2026-11-18: …"), never a rewrite, so Kiro's report and the file's history stay readable together.

## Hooks and steering

Three `PostFileSave` hooks under `.kiro/hooks/`: one validates a saved day file against the content grammar, one lists strings missing from the English twin, one used to run the state tests on every save and was changed in early November to run once per task (credits). The hooks only report; they never edit.

Five steering files: product, voices (the four sources of text in the game and their grammar), tech, structure, and a three.js file that only loads for the room's code.

## What worked

- **Specs as the contract.** Kiro's departures from a spec were listed in its report, so review meant reading the report against the file, then the diff. Where a departure was wrong, the correction came as the next commit, under Claude's name, with the reason in the message.
- **Kiro never in content.** The game's 18 days of Chinese and English text, the chat pools, the strings — all of it stayed in one voice because one writer held it.
- **The headless replay.** A driver script walks a whole day (or all eighteen) in headless Chrome from the content files alone, pressing every checklist item, and reports what it could not do. After every structural change the replay ran before the author did.
- **A second Claude session for the 3D room.** The code-built room (three.js) was prototyped in a parallel session and handed over as a second Vite page with a message protocol; Kiro then wired it into the game from specs that named the commands. Two sessions, one repository, explicit commits with both names.

## What did not

- A spec written from a mechanism the author later replaced had to be cleaned out of six places (steering, specs, content, code, notes, memory). The rule that came out of it: a mechanism change ships with its cleanup list.
- Kiro's credits ran short once, in early November, and the hooks were thinned to save them. The 4,000-credit Kiroween bonus arrived on 2026-11-03; after that the constraint was design clarity, not credits.
- Headless Chrome on software GL could not render the 3D room in time; the game falls back to the flat scene, which is correct, but it meant the first real look at the second phase of the final fight came from a real GPU, not from the test rig.

## Disclosure

The author credits the AI share openly: Claude wrote the specs, the code review, and (from her decisions and in her voice) the text; Kiro wrote most of the engine and view code; the art is generated (Muse, qwen-image) from her descriptions and corrected by her; the theme song's words are hers, sung by Suno. The game's credits say so.

---

*Repository: `.kiro/specs/` (83), `.kiro/steering/` (5), `.kiro/hooks/` (3), `docs/kiro-log.md` (Kiro's own log, appended after each task).*
