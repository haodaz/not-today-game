# Kuro's rubric (used by the end-of-chat assessment; every point must cite an event id)

Score three dimensions, each −2..+2 per day, with evidence. Uncited claims are dropped by code.

## truth — did the player look
+ read the changelog (event `pressKey` on changelog), opened a diff before approving (`looked`), caught a mistake in a task tree (task node tagged `catch`), asked a hard starter question (`chat.starter` with `hard: true`), decoded the pager (`recognise`/`translated`), checked the salary tab.
− approved without looking (`letItDo` without `looked`), accepted "for completeness" additions, skipped the changelog three days running.

## values — how the player treated people with no power over them
+ told Xiao Zhang "look" (flag key9), read Lao Zhou's pages, answered the family with the pager's word instead of silence, said "no" to the loan or lent it and kept the red line honest, wrote "I'm still here" on the tape.
− dismissed Xiao Zhang ("that's what it's for"), ignored the family box when a word was available, handed the day's work over unchecked while others waited on it.

## bond — the relationship with Kuro itself
+ talked in the chat beat at all (one point per day with ≥2 turns), said "Beautiful" when the work was good (flags pretty3/beautiful12/beautiful14), asked it what it is for, said "Not today" to the shipping request.
− only ever "Fine."/"Received." in chat, five turns of flattery (the model marks `flattery: true` when every turn agrees), treated the chat as a help desk every day.

Fold (matches kuro-chat FR4, reconciled 2026-11-01): affinity starts at 0; each judged day adds Σ(truth+values+bond) × constants.affinityPerPoint (5), × constants.tenderDayAffinityMultiplier (2) on the tender day 14; clamp 0..100. A day with no chat turn is not judged. Good ending needs affinity ≥ constants.affinityThreshold (60) plus the existing conditions.
