# kuro-chat — tasks

- [ ] T1. `chat` event fields `said` / `answer` / `offline`; `chatMemory.recent` from it.
- [ ] T2. `judged` event and its fold (affinity, judgement, evidence with `delta` / `dims`, summary; one per day).
- [ ] T3. Rule scorer (`kuro/scorer.ts`), same shape; `ev<n>` ids; citation check.
- [ ] T4. Decay filter (`kuro/decay.ts`), model output only.
- [ ] T5. Online turn (waiting line, function call, fallback) and judgement at bed (lie-down waits ≤ 20 s).
- [ ] T6. Credits from `dims` and `judge.offline.*` notes.
- [ ] T7. Tests (FR6) with a mocked invoke; snapshots after checking diffs.
