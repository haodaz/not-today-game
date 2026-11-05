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

## R4. Kuro's English looks like Kuro's English, everywhere (author 2026-11-04: 「克总的英文是有 css 风格的……红蓝模糊，然后有自己的字体」「我说的英文是怪话」)
The game already has the style in the chat overlay and the mini pill (`.k .t .plain`, `.kmini .c .plain`: a 1 px red / blue split) and the gamebook uses a monospace face for Kuro (`p.say`: Menlo). Apply it wherever Kuro speaks, not only in the chat:
- **Where**: the task shell's conversation column (board beats and non-board threads), the work thread's Kuro bubbles, the HUD pill, the call/meeting lines Kuro says, dialogue-box lines whose speaker is Kuro or 屏幕.
- **The day's idiom** (the `Idiom of the day (constant)` of that day's kuro-days file, matched exactly): Kuro's face (`font-family: "SF Mono", Menlo, monospace`, size 0.95em), no split.
- **Uncanny lines** (怪话): Kuro's face **plus** the red / blue split (`.plain`). A Kuro line is uncanny when (a) it is one of that day's `## Red-blue lines`, or (b) in the zh build, it has no Han characters and is not the idiom, or (c) its text starts with the content marker `~ ` (marker stripped before display; lets en content mark one).
- Everything else Kuro says (ordinary Chinese, or ordinary English in the en build) stays in the normal face.
- Tests: idiom → mono, no split; a red-blue constant → mono + split; zh build English non-idiom → split; `~ ` marker → split, marker not shown; ordinary line → neither.
