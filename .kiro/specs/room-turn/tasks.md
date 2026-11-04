# room-turn — tasks

- [ ] 1. Facings: `window` view; `bed` becomes the bed facing (bed.jpg); the four facings are top level (no back strip, Esc / right-click / wheel-back do nothing); 门 loses its back strip, 房间 loses its door edge. (R1)
- [ ] 2. Turn edges (left / right 8 %, arrow + `hud.turn.*`, `walk` cursor) and ←/→ keys with the focus rules. (R2)
- [ ] 3. The turn motion: 450 ms slide with one bob, placed things ride with their still, one queued turn; reduced motion = crossfade. (R2)
- [ ] 4. Shortest-way moves for everything that sets `door` / `bed` today (knock, sleep flow, `data-view`, the 门 hotspot); from 桌子 / 屏幕 back out first. (R2)
- [ ] 5. Hotspots for `bed` (bed, box) and `window` (mealTable); the meal moves from 桌子 to the meal table, eating happens there. (R3)
- [ ] 6. Evening / collapse / overlays on the new facings, base still where a stage still is missing. (R4)
- [ ] 7. Tests and snapshots as listed; update the tests that used 门's back strip or 房间's door edge. (R5)
- [ ] 8. Log entry in docs/kiro-log.md.
