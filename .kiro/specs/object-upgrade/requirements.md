# object-upgrade — requirements

Author decision 2026-11-01: Kuro offers to upgrade each old object separately, so the game's core rule (resolution is danger) is a daily temptation from the day an object arrives, not a single event on day 13. Data: `content/upgrades.json`; state: `upgraded` in variables.json.

## FR1. Offers
- From `offerFrom` (only if the object is found), Kuro's small window shows the `offer` line with two buttons (`upgrade.yes` / `upgrade.no`). Declining hides it; after `nagAfterDays` it returns once with the `nag` line. On `finalOfferDay` the `finalOffer` covers every object still not upgraded. Offers never consume chat turns.
- Accepting appends an `upgrade` event `{object}`; `upgraded[object] = true`; log for the rubric with `judgement.accept`; declining logs `judgement.decline`.

## FR2. What upgrading changes (all derived from `upgraded`)
- The object's screen switches to the high-resolution channel (device skeleton: antialiased, no integer-pixel rule) and shows the convenient output described in `gain` (pager digits translated, chick auto-fed and animated, tape transcribed, etc.).
- At night the object cannot be held up (it is not offered in the choice list; the dialogue box says nothing about why). Its lent word is removed from the reply menu. The child's message on it is replaced by the "corrected" text from content (pager 0.7734 → 你好; tape half-sentence completed). Its desk-bar icon renders in the new high-res style: the only visible tell.
- The good ending's "recognise all six, block every raid" is evaluated with upgraded objects counted as unable to block.

## FR3. Tests
- Property: an upgraded object never appears in a night choice list; its word is never in the menu afterwards.
- Snapshot: pager offer on day 5, nag on day 8, final offer day 13; desk bar with one upgraded object.
