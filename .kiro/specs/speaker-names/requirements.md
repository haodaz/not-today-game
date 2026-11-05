# speaker-names — requirements (2026-11-05, Claude)

Some dialogue speakers are not in `content/npc.json` (they get a silhouette): 「同事」 in the prologue, 「同学」 in day 2's camera memory. Their `who` is shown as-is, so the English build shows Chinese names. 
- A speaker's display name: npc.json's `name` string if the speaker is an NPC (as today); otherwise the string `who.<who>` if it exists in the active strings; otherwise `who` itself (as today).
- Claude adds `who.同事` (同事 / Colleague) and `who.同学` (同学 / Classmate).
- Tests: an NPC keeps its name; `同学` shows Classmate in en and 同学 in zh; an unknown name shows as-is; the silhouette is unchanged (still keyed by `who`).
