# photos-twin — requirements (2026-11-05, Claude)

`content/photos.json` (what a developed room photo shows) is Chinese only, so the English build shows Chinese captions under photos and in the title 影集 / Album. Give it an English twin, the way `content/en/objects.json` and `content/en/upgrades.json` work.

## R1. The twin
- `content/en/photos.json` (Claude's, already written): the same `room` entries in the same order with the same `day` / `facing`, the same `overlay` paths; only `add.text` differs. `screen` is the same list (empty today).
- The strict loader in `src/state/photos.ts` reads both and checks the twin against the Chinese: same number of entries, same (day, facing) at each index (screen: same (at, day)), overlay equal where present, text present in the twin wherever the Chinese has one. A mismatch fails at import with the file and index named.
- Under lang=en, `photoAdds` returns the twin's text with the shared overlay; under zh, the Chinese. Use the existing `bilingualValues` helper (src/state/content-locale.ts) like `localiseSleeptalk` does, so a locale switch re-reads without a reload.
- Both files optional as today; the Chinese without its twin fails (as every content twin).

## R2. Forwarded voice cards (voice-babble follow-up)
- A forwarded voice note card (`src/world/desktop/messages/cards.ts`) is playable like a voice bubble: the same `voice-play` action and data attributes, its own `data-voice` key, `data-who` = the original speaker. Same play / stop / one-at-a-time rules; nothing logged.

## R3. Tests
- Twin: zh shows the Chinese caption, en the English one, overlay identical in both; a twin with a missing entry, a swapped facing, or a different overlay fails.
- Forwarded card: renders as a voice-play button; click plays (the rig in tests/voice-babble.test.ts); another bubble stops it.
