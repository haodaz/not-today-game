# kuro-chat — tasks

- [x] T1. `chat` event fields `said` / `answer` / `offline`; `chatMemory.recent` from it (src/state/chat.ts).
- [x] T2. `judged` event and its fold (affinity, judgement, evidence with `delta` / `dims`, summary); one per day, checked from the log.
- [x] T3. Rule scorer (`kuro/scorer.ts`), same shape and the same validation; `ev<n>` ids.
- [x] T4. Decay filter (`kuro/decay.ts`), model output only.
- [x] T5. Online turn (waiting line, function call, fallback) and judgement at bed (lie-down waits ≤ 20 s).
- [x] T6. Credits from `dims` and `judge.offline.*` notes.
- [x] T7. Tests (tests/kuro-chat.test.ts) with a mocked invoke; snapshots checked.
