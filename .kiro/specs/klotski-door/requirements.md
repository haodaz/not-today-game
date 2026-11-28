# klotski-door: day 17's sliding blocks are the gods in your room, and the small block is you

Author, 2026-11-27 (ledger #170). Her words: 「你得想想最后华容道是挪谁，让谁进来。是不是应该是几个邪教 + 所罗门、10–17 天的古神。最后通开一条路，涌进来触手（不同的角色意味着不同大小的格子，还有一个小格子是玩家自己」. And: 「青禾不要留」.

Before this spec: day 17's klotski (game-swaps, 2026-11-16) had four callers as named 2 × 1 blocks (青禾 / 克总 / 老王 / Vivi), a nameless 2 × 2 block, two tall and two small blanks. Any named block pushed out through the door filled the form's slot with its card. 青禾 is removed from the game, so this design goes.

After this spec: the board is the player's room, full of everyone who moved in on days 7–16. The player moves **them** to make way for **the one small block that is the player**, believing it is the way out. When that block reaches the door and is pushed down, the door opens, the player does not leave, and tentacles pour in along the cleared way.

Scope for Kiro: engine, content shape, view, CSS, tests, the walk driver. **No sentence is written by Kiro**: every string below is given verbatim; the form's cards and Kuro's lines for day 17 are Claude's and are rewritten separately (do not touch `cards`, `given`, `beats`, `kuro`, `launch` of day 17's board; only its `game` block as given in R1).

## R1 · Content shape

`BoardGame` kind `klotski` becomes:

```ts
{ kind: "klotski"; slot: string; level: readonly string[]; exit: string;
  blocks: Readonly<Record<string, { label: string; role: "nameless" | "gate" | "god" | "person" | "you"; card?: string; face?: string }>> }
```

- `exit`: the letter of the one block that can go through the door. It must be in `blocks`, have `role: "you"`, be 1 × 1 and have a `card` that is one of the board's cards.
- Every letter in `level` must be in `blocks` (no anonymous lower-case blocks any more). `label` may be the empty string only for `role: "nameless"`.
- `face` (optional): an image path for a `person` block (the NPC's avatar).
- The loader (`src/state/days/tasks.ts`) checks all of this and fails loudly; the zh / en twin check compares `level`, `exit`, and each block's `role`, `card` and `face` (labels differ by language).

Day 17's `game` block, zh (`content/tasks/day-17.json`), verbatim:

```json
"game": {
  "kind": "klotski",
  "slot": "r1",
  "exit": "U",
  "level": ["U.ZW", "SNNH", "SNNH", "FYYP", "FV.P"],
  "blocks": {
    "N": { "label": "", "role": "nameless" },
    "Y": { "label": "看门的", "role": "gate" },
    "H": { "label": "黄衣", "role": "god" },
    "F": { "label": "天平", "role": "god" },
    "P": { "label": "不睡的", "role": "god" },
    "S": { "label": "黑山羊", "role": "god" },
    "W": { "label": "老王", "role": "person", "face": "/npc/boss_av.png" },
    "Z": { "label": "老周", "role": "person", "face": "/npc/laozhou_av.png" },
    "V": { "label": "Vivi", "role": "person", "face": "/npc/partner_av.png" },
    "U": { "label": "你", "role": "you", "card": "c1" }
  }
}
```

English twin (`content/tasks/en/day-17.json`): the same, with labels `""`, `"The gatekeeper"`, `"In yellow"`, `"The scales"`, `"The sleepless"`, `"Black goat"`, `"Lao Wang"`, `"Lao Zhou"`, `"Vivi"`, `"You"`.

The level is computed: the fewest pushes that bring `U` to the bottom row over the door is 27, plus the push through the door (28). A test asserts this number with `klotskiPath`.

## R2 · Engine (`src/world/desktop/workbench/klotski.ts`)

- Only the `exit` block can leave. It leaves when it stands on the bottom row with all its cells over the door columns (`DOOR_X` and `DOOR_X + 1`) and is pushed down. Any other block pushed down on the bottom row does not move (the same game returned).
- `klotskiPush`, `klotskiUndo`, 重排, the history, the move count: unchanged otherwise.
- `klotskiPath(game, id)` works for the 1 × 1 exit block; blocks of the same size and role (the four gods; the three persons) are interchangeable in its state key.
- `klotskiCard` returns `blocks[exit].card` once the exit block is out.
- `klotskiPick` on the nameless block still sets `nameless` (its sub-line stays).
- `klotskiSolve(g, id, now)` (dev / tests) only accepts the exit block.

## R3 · The door moment: nobody leaves, they come in

When the exit block is pushed through the door:

1. The block does **not** slide out. It stays on its cell over the door; the door under it opens (the existing door-open look).
2. Tentacles come in through the door: they grow from the door cells upward through **the cells that were empty at that moment and every cell the exit block passed over on its way** (keep the exit block's path in the game state: the list of cells it stood on, in order, from the start), then over the whole board. The exit block is the last thing covered. Reuse the existing tentacle drawing (`kl-` classes from the current exit sequence and the rot veins of ce1eda2); several tentacles, not one.
3. Lines, one after another in the stage's sub-line (strings in R5): `klotski.stage.door1`, then `door2`, then `door3`.
4. Timing: the whole moment fits in `KLOTSKI_DONE_MS` (raise it to 6000); then the form returns as it does today with the slot filled.
5. Reduced motion: no growth animation; the final frame (tentacles everywhere, the three lines together).

## R4 · The look of the blocks by role

The tray, wood, seals and rot of commit ce1eda2 stay (the homage keeps its look). On top of it:

- `nameless` (2 × 2): as today (the lidless eye, no name).
- `gate` (2 × 1): a keyhole in the middle of the block, an arch line over it; its label under the keyhole.
- `god` (1 × 2): the existing tall figure, plus one small mark per block chosen by its letter so the four are told apart: `H` a torn crown, `F` a pair of scales, `P` a closed eye, `S` a horn. Draw them as inline SVG or CSS shapes, single colour (the seal red), no image files.
- `person` (1 × 1): the `face` image, round, desaturated, with the label under it.
- `you` (1 × 1): a plain light tile with the label and a thin amber ring; it is the only block that looks alive (no rot is ever drawn over it before the door moment).
- The picked block's highlight, keyboard control and focus order: unchanged.

## R5 · Strings (verbatim; zh then en)

Replace:
- `klotski.stage.kick`: 「回电话」 / "Call back" (unchanged)
- `klotski.stage.title`: 「把自己挪到门口」 / "Get yourself to the door"
- `klotski.stage.sub`: 「屋里站满了。最小的那一块是你。门在最下面。」 / "The room is full. The smallest block is you. The door is at the bottom."
- `klotski.stage.nameless`: 「最大的那块没有名字。它不出去。」 / "The biggest block has no name. It is not going out."
- `klotski.stage.blocked`: 「它们出不去。门只给你开。」 / "They cannot go out. The door only opens for you." (shown when any other block is pushed down on the bottom row over the door)

Add:
- `klotski.stage.door1`: 「门开了。」 / "The door opens."
- `klotski.stage.door2`: 「我没有出去。」 / "I did not get out."
- `klotski.stage.door3`: 「是它们进来了。」 / "They came in."

Remove: `klotski.stage.out`, `klotski.stage.won`, `klotski.stage.left` (and their uses).

All menu / status strings must use characters the bundled fonts have (`tests/fonts.test.ts`); if one of the lines above fails that test, report it instead of changing the wording.

## R6 · What must keep working

- The form: after the door moment the slot `game.slot` holds `blocks[exit].card`, the board is approved exactly as today, the chick's fight control (chick-fights) is offered before the game starts and at the settlement.
- The grade (`grade` in klotski.ts): today it is wrong when the block that went out is not the form's answer, else `byCount(moves, 30, 60)` capped by Kuro's help. Now the only block that can go out is the exit block: nothing out yet stays wrong, the exit block out is graded by the count alone (its card is the slot's answer by content; the loader checks `blocks[exit].card === ` the answer of `slot`); the count thresholds become `byCount(moves, 45, 90)` (the shortest way is 28).
- The walk driver (`script/tools/auto-day-shoot.mjs`): its dev finish for klotski takes the exit block out; a headless walk of day 17 still clears every required item.
- Tests: update `tests/klotski.test.ts` and `tests/klotski-look.test.ts`; add cases for: only the exit block leaves; a god pushed down over the door does not move and shows `blocked`; the path length (28); the exit block's recorded path; the door moment's three lines in order; reduced motion; the zh / en twin check on the new fields. `npm test` and `npx tsc --noEmit` green before the commit.

## Not in this spec

- The form's cards, the day's lines, Kuro's lines, the launch poster text (Claude's).
- Removing 青禾 from other files (Claude's).
- Any change to other games.
