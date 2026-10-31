# dialogue — tasks

- [x] T1. `chat` event: type, kind list, reducer (turn +1, cap, exactly one of q/text), lie-down resets the count; tests.
- [x] T2. Offline answers in `parseKuroDay` (`answers.q`, `answers.free`), strict; tests over all 18 files.
- [x] T3. Queue: `page`, `voice`, endings `kuroOffer` / `kuroAsk` / `kuroTurn`; `advance(d, screens)`; `lineKey` with the page.
- [x] T4. `src/world/dialogue/layout.ts`: width table, `wrap`, `screens`, markers.
- [x] T5. `src/world/dialogue/box.ts`: the box, tags, choices in the box, marker, history chip; the history panel; `session.dlgLog`, cleared on a new day.
- [x] T6. `src/world/dialogue/kuro.ts`: the conversation (offer → ask → turns → bedtime; work beats; input); actions `kuro-call`, `kuro-q`, `kuro-more`, `kuro-send`, `kuro-leave`, `dlg-history`, `dlg-history-close`; Esc order; `openChatIfDue` pushes the prompt.
- [x] T7. Wire into room/hud.ts and the desktop root; the pill replaces the small window; remove `kuroOpen`, `kuroPeekUntil`, `kuroCall`, `renderKuroMini`, `kuro-expand`, `kuro-fold`.
- [x] T8. Motion: reveal wraps `.txt`; choices inside boxes; `.dlg-player` keyed and rising; the body's 320 ms return.
- [x] T9. CSS: the box, tags, markers, choices, the player's box, the history panel; the HUD body 192 px and the pill's offset.
- [x] T10. FR3 tests (snapshots, properties); update the tests that used the overlay or the small window.
- [x] T11. kiro-log; TODO strings for Claude (`title.q.name`, `dialogue.tag.door|gap|desk`).
- [x] T12. Correction 2026-11-01: Kuro's portrait at the box's right end (the one body slot, busy while its line appears), name-only tag, `KURO_LINE_BOX` column, ↺ moved; the player's box clear of it (Kuro's box raised); tests + snapshots.
- [x] Addition 2026-11-01: the player's portrait for inner lines (pronoun → file, `_kid` on dream nights, Kuro's slot and size, never two at once, inner lines wrap left of it). Tests in tests/dialogue.test.ts.
