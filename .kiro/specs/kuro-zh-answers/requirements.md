# kuro-zh-answers — requirements (2026-11-04, author's language rule)

「中文版里只用英文说怪话啊，普通交流不能全英文。」 In the zh build Kuro's ordinary lines are Chinese; English only for the day's idiom and the red-blue (uncanny) lines. Today the **layered answers** (`## Layered answers`, said verbatim per affinity bucket) and the **offline answers** (`## Offline answers`) in `content/kuro-days/day-NN.md` exist only in English, so a zh player gets a whole English sentence. Starters already have zh / en columns.

## R1. Content shape (Claude fills the text after this lands)
- Two optional sections per day file, same line formats as their English twins:
  - `## Layered answers (zh)`: `- unlock: qN → low: "…" | mid: "…" | high: "…"` (taboo stays on the English line only; the zh line must not carry one).
  - `## Offline answers (zh)`: `- qN → "…"` and `- free text → "…"`.
- Every unlock / q in a zh section must exist in its English section (same set); a zh section may be absent (then English is used, as today).
- `## Red-blue lines` stay English only (uncanny, every language).

## R2. Who reads them
- The function (`supabase/functions/_shared/kuro/dayfile.ts`, `variable.ts`): `lockedFor` picks the zh text when the turn's `locale` is `zh` and the day has the zh line; the bucket, d100 and taboo logic are unchanged (taboo from the English line).
- The game (`src/world/desktop/kuro/days.ts`): `offlineAnswer` picks the zh line when the content locale is zh and it exists.
- `npm run bundle:kuro` carries both (content.ts regenerated); the bundle check still passes.

## R3. Tests
- Parser: zh sections read; a zh unlock not in English fails; a zh line with taboo fails; absent zh = English.
- Locale: zh turn → zh layered text, en turn → English, same bucket and taboo; offline answer zh / en by content locale.
