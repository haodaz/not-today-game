# kuro-chat — tasks

- [x] T1. `chat` event fields `said` / `answer` / `offline`; `chatMemory.recent` from it (src/state/chat.ts).
- [x] T2. `judged` event and its fold (affinity, judgement, evidence with `delta` / `dims`, summary); one per day, checked from the log.
- [x] T3. Rule scorer (`kuro/scorer.ts`), same shape and the same validation; `ev<n>` ids.
- [x] T4. Decay filter (`kuro/decay.ts`), model output only.
- [x] T5. Online turn (waiting line, function call, fallback) and judgement at bed (lie-down waits ≤ 20 s).
- [x] T6. Credits from `dims` and `judge.offline.*` notes.
- [x] T7. Tests (tests/kuro-chat.test.ts) with a mocked invoke; snapshots checked.
- [x] T8. Correction 2026-11-01, reply language: the client sends `locale` with turn and judge; the function ends the system prompt with `LOCALE_LINES[locale]` (own block; missing/unknown → zh); "Speak English" and "notes in English" removed. Tests (tests/backend.test.ts, mocked model): the locale line is the last line for turn and judge in both locales, the cached block is the same across locales, fallback to zh; tests/kuro-chat.test.ts checks the client sends it. Snapshot gained the fifth block (diff checked).
- [x] T9. The idiom in both languages: the bundler reads `Idiom of the day (zh)` as `idiomZh` (required, all 18 days). The prompt uses the locale's idiom verbatim; the "render it yourself" clause is removed. `JUDGE_ASK`: the summary is always English. Tests: idiomZh on all 18 days; zh prompt has the Chinese idiom and not the English one, en the reverse. Snapshot updated (diff checked: the idiom line and the zh locale line).
