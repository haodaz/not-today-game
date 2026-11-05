# photo-album — requirements (author 2026-11-04)

「因为拍照后洗出来的素材是可以穷举的，我们可以给用户在登录页面做个影集哈哈哈」
The room photos are a closed set: `content/photos.json` `room` (days 3–17 × 4 facings, plus day 18's four). A run has only 10 sheets, so a player collects them over several runs. The title page gets an **影集** next to the object drawer (object-drawer 2), built the same way: from the cross-run profile, store-free, nothing appended.

## R1. What counts as collected
- A room photo is collected when it has been **seen developed** in a run (its final stage shown at least once: the album opened it on day n+1, or the day-18 one finished developing). Key: `"<day>:<facing>"` (the shooting day).
- The cross-run profile gains `photos: string[]` (first-seen order; unknown keys dropped on read, like `objects`). Written when collected, never removed. `src/ui/collection.ts` reads it into `Collection.photos`.

## R2. The 影集 on the title page
- A button 影集 (`title.album`) beside the object drawer, shown once the camera has been found in any run (`objects` contains `camera`).
- Opening it: pages by day (day 3 … day 18), each a row of four cells (房间 · 床 · 门 · 窗, the facing names from strings).
- A **collected** cell: the photo as the album shows it developed (the facing still + the content's addition), small; clicking it shows it large with the addition's text under it; ← → between collected photos; a back control returns to the grid.
- An **uncollected** cell: a blank white instant sheet with a small label `album.cell` 「第 {day} 天 · {facing}」, nothing else.
- **Day 18**: its four uncollected cells are blank sheets **without** a label (just 「？」), until collected.
- A count at the top: `album.count` 「{n} / {total}」.
- Same look as the object drawer (light, cards), no store, no events.

## R3. Strings (Claude adds): `title.album` 影集 · Album; `album.cell` 第 {day} 天 · {facing} · Day {day} · {facing}; `album.count` {n} / {total}; `album.back` 返回 · Back.

## R4. Tests
- Profile round-trip: collecting `"10:window"` writes it once; reading drops unknown keys; order kept.
- Collected only when seen developed (not when shot; day 18 when its 20 s finish).
- Title: 影集 hidden before any camera, shown after; grid of 16 days × 4; collected vs blank cells; day-18 blanks unlabeled; count; ← → only over collected ones.
