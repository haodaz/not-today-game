# upgrades-twin — requirements (2026-11-05, Claude; follows kuro-zh-answers R4)

Kuro's upgrade offers live in `content/upgrades.json` in English only, so in the zh build they now render as uncanny (red / blue) although they are ordinary sales talk. Give the file an English twin like `content/en/objects.json`:
- `content/upgrades.json` becomes the Chinese source; `content/en/upgrades.json` its twin with the same shape (same objects, same keys, same judgement / evidence fields); the strict loader checks the twin like the objects twin and the active content locale picks the text (`offer`, `nag`, `kuroNote`, `finalOffer`). `judgement.*.evidence` stays the English source in both (the judge reads it, not the player).
- Until Claude writes the Chinese, both files carry today's English (copy it now so nothing changes on screen).
- Tests: the twin must match shape; zh locale reads the zh text, en the English; a missing twin key fails.
