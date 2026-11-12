# Kiro brief — the template (copy, fill the <…>, paste into Kiro)

Rules that never change (the author's, since 2026-11-02):
- Kiro does not run git, does not commit, does not deploy. Claude commits Kiro's work after reading it.
- Kiro does not edit `content/` — content is Claude's. When content is missing, Kiro tests with fixtures.
- Shell only for the two checks; no output means success; never retry more than twice.
- Every job starts from a spec under `.kiro/specs/<name>/requirements.md` (English).
- Kiro ends with a report per item and per file, its decisions, snapshots that changed for another
  reason, and a log entry in `docs/kiro-log.md`.

```
Do not run git commands; tree is current (<hash>), green. Shell only for `npx tsc --noEmit 2>&1 | tail -20` / `npx vitest run 2>&1 | tail -20`; no output = success; never retry > twice. Do not commit. Do not deploy. Do not edit content/ (it is Claude's); test with fixtures when content is missing.
<N> items. Do 1–<k> first and run tsc + vitest; then the rest if you still have room. If you stop early, say so.

1. <name> — .kiro/specs/<name>/requirements.md, <which section / addition>. <two or three sentences: the files, the shape, the behaviour, what must never happen>. Tests per the addition.
2. …

Finish with tsc clean and vitest green. Report per item and per file, decisions, and any snapshot that changed for another reason. Log in docs/kiro-log.md.
```

Before pasting: `git pull`, read the spec once more, and make sure every string the spec needs is
already in `content/strings/zh.json` + `en.json` (Claude adds them first).
