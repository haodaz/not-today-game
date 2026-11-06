---
inclusion: always
---

# NOT TODAY — product

NOT TODAY is an eighteen-day desktop narrative horror game that runs in the browser. The player moves the days forward themselves: a day ends when they lie down, and the next day starts when they boot again. (Decision 2026-10-30: the earlier "one real calendar day is one game day" rule is dropped; nothing in the game reads the wall clock for story purposes.)

The player is a tired co-founder working from a rented room in a rainy city. Every day has the same five beats: boot, open the box, work, look at the desk, shut down. Two external monitors show a modern work system (messages, documents, spreadsheet, code) and an assistant named Kuro, a black Labrador puppy's head on a small round octopus body. The system gets kinder every day and harder to read. A blind-box case with no sender lets one small box loose each day, eight objects in the order of the player's own years: a knock-off Tamagotchi that starved in 1997, an instant camera, a numeric pager (the father's), a phone card, a cassette and Walkman, an English-only pocket dictionary, a solar calculator, the first feature phone; the ninth box, loose only on day 18, holds a shipping slip. The night an object arrives, the player dreams its memory. These low-resolution objects are the only things still trying to keep the player alive.

From day 10 the work is the gods' work: the finished result sits on the desk, and at night a hand reaches out of the gap between the two monitors to collect it (that day's god; the author's joke: 古神无纸化办公). Nights 1–9 have no hand. The old objects are never held up to it (decision 2026-11-06; the earlier raid-and-block design is gone).

## What the player can never do

- **Die.** There is no death and no game over screen from damage. The only failure is being replaced (SAN reaches 0), and that restarts from day 1.
- **Speak freely to the people above them.** To the boss, the partner, the client and the family the player has a fixed menu of a few replies (`Fine. Received. Whatever works. What about salary?`); the menu shrinks as stages advance and objects can lend one extra word each. The whole keyboard exists only in the company group and with Xiao Zhang and Lao Zhou, and it is taken away over time.
- **Skip a day or a beat.** The five beats run in order; the bed is locked until the day's tasks are done. Lying down ends the day; there is no other way to advance it and no way to go back.
- **Leave the room.** The door never opens until the good ending.
- **Fight the hand.** On a hand night (days 10–17) the only moves are to hand over the day's work or to refuse; on night 18, to fill in the slip or to take the hand.
- **Reset the chick.** The reset hole exists and is always pressable and never does anything.
- **Skip the chat and still get the good ending.** Affinity only grows by talking.
- **Restart.** The story never offers a restart: a run ends only through an ending, and the bad and survive endings are what bring the player back to day 1. Outside the story, the settings panel has 重新开始这一局 (and, on the title, 清除全部记录), each behind a confirm question (author, playtest 2026-11-05: a player must be able to start over).

## What the game is about

The AI era's effect on work, and how people respond to it. The unnameable thing is not AI. It is what this era does to people: it does not replace the one who does the work first, it replaces everyone around them, and makes them nicer.

## Three endings

- Bad: SAN reaches zero, the player is replaced (a "You and You" chat appears). Restart from day 1 with nothing carried over.
- Survive: reach day 18, ask Kuro to post the box, lie down. The next page says "Day 1".
- Good: never let Kuro do a task unchecked, recognise all eight objects, keep assimilation low (three-meters), say the key lines, **and talk with Kuro every day until its hidden affinity reaches the threshold**; on night 18 the branch happens at bedtime, before the shipping slip is written: the player does not fill in the slip, shakes the hand, and on day 19 the door handle turns.

## The chat beat is the heart (author decision 2026-10-31)

After the day's work and before bed, the player may talk with Kuro. Kuro remembers earlier days and picks up what the player said yesterday; the talk is mutual, not Q&A. Each day offers 3–4 hand-written starter questions (from `content/kuro-days/day-NN.md`) that gradually uncover Kuro's background and tastes, so that over eighteen days it stops feeling like an AI. After five questions in a day Kuro says, as a constant line: "You should sleep. I don't have that many tokens for you. Save them for work." Kuro's background, tastes and the starter questions are authored data; the model only continues the conversation and never invents lore.

**Kuro judges the player.** Behind the scenes, Kuro keeps an opinion of the player, and the ending is that opinion. The old god decides fate: stages, raids and SAN follow the calendar and no one escapes them. Kuro decides where you go from there. Three things it weighs, each with evidence from what actually happened:

1. Pursuit of truth: did the player read what it wrote, catch its mistakes, ask the hard questions (`Did you switch models?`, `What are you for?`), look at the changelog, decode the pager.
2. Values: how the player treated the people who had no power over them (Xiao Zhang, Lao Zhou, the family), whether they lent the money or said no and why, whether they handed work over unchecked.
3. The relationship with Kuro itself: did the player talk to it, say "beautiful" when it was true, treat it as a reader and not a tap.

The judgement is stored as a structured record (`affinity` plus per-dimension notes with evidence), updated at the end of each chat beat, and read by the ending. It is never shown as a number to the player. Players feel it only in how Kuro talks to them. **At the end, the credits are Kuro's log**: every ending (bad, survive, good) rolls the evidence it kept, one line per entry, in order of days: the day, what the player did, and in which direction it moved Kuro. The player reads their own eighteen days as the thing that watched them remembers it. The log is built from the stored evidence only, never generated at credits time.

## Who it is for

People who have had a job like this. The game should entertain while it passes something on. It never tortures the player. Every page has room for dry humour.

## Hackathon

Kiroween 2026, category Resurrection (fallback: Costume Contest). The story, the setting bible, the branching Chinese gamebook and the concept art were written before the hackathon by the author with Claude and are published at github.com/haodaz/nottoday under CC BY-NC-ND. This repository is the game built from them. All game code is new and written in this repository during the submission period. Disclose this in the README and on the submission form.

## Per-object upgrades (author decision 2026-11-01)

Kuro offers to upgrade each old object separately from the day after it arrives (`content/upgrades.json`). Upgrading is convenient and makes the object part of the new world: its screen gains resolution, its ability in work becomes automatic, its lent word disappears, the child's message on it is "corrected"; three days later Kuro has moved in and the object is gone (object-upgrade). Each upgrade raises assimilation (three-meters). The game never explains the cost; the only tell is the icon. There is no all-at-once "全员升级" offer (decision 2026-11-06).
