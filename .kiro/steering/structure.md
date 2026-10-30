---
inclusion: always
---

# Structure

```
.kiro/            specs, steering, hooks, settings (never gitignored)
content/          all story data, read-only for code
  days/day-01.json … day-18.json, bad-end.json
  tasks/           hand-written dialogue trees per day
  pools/stage-0.json … stage-5.json
  kid.json         pager message schedule
  dictionary.json  word-by-word table
  strings/zh.json, en.json
  frames/          pixel frames for object screens
  kuro-days/       daily stance snippets for the chat beat
src/
  state/           store, time function, event log, saves, stages
  engine/          day engine (five beats), night hand, endings, SAN
  devices/         skeleton + chick, pager, iccard, tape, dictionary, calculator, phone
  world/           the two monitors: messages, docs, sheet, code, Kuro window, decay filter
  room/            the room view (parallax or three.js)
  ui/              title page, bookmarks, settings
  i18n/
tests/             unit, snapshot, property-based
docs/              kiro-log.md (appended by a hook after each task), submission write-up
public/
```

Conventions: small commits, one spec task per commit where possible, commit message starts with the spec name (`world-state: …`). Claude writes `content/`; Kiro writes `src/`, `tests/`, `.kiro/`. Neither edits the other's area without a note in `docs/kiro-log.md`.

Spec order: world-state → day-engine → device-skeleton → device-chick → device-pager → tasks → assistant-tools → san-and-endings → night-hand → recognize → names → device-calculator → device-dictionary → device-tape → device-iccard → new-world → dream-state → i18n → demo-mode. The first three produce a running shell; through device-pager gives a playable nine-day build.
