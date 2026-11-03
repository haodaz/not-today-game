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

## Addition 2026-11-03 (author): an upgraded object can be invaded

Author: 「小鸡升级之后是不是克总就可以入侵了，因为像素清楚了」「所有升级的东西都可以入侵，正好大部分屏幕像素都够，这样后面就不能发挥真正的功能，反而被扰乱了」. The old screens (32 × 16 dots, seven segments, 2 × 16 cells) are too coarse to hold Kuro: an object that was **never upgraded is never invaded**. Upgrading gives it a smooth hi-res screen, and that is big enough for Kuro's face (the 64 × 64 frames in `public/objects/kurogotchi/*.png`). Never explained in-game. The drawer (老物件) always shows the original and is never invaded.

### Level
A pure helper `invasionLevel(id, state, events)` in a new `src/world/objects/invasion.ts`: 0 when the object is not upgraded; otherwise from `d` = today − the day of its `upgrade` event:
- **1** (glimpses) for d = 0–2;
- **2** (interference) for d = 3–4;
- **3** (taken) from d = 5, or from day 16 whatever d is.
`ObjectEnv` gains `invasion: 0 | 1 | 2 | 3` and `seed: string` (run id + day + object), set by the host where the env is built. Only Kuro gets randomness: every chance below is `unit(hash(seed + n))` with `n` the program's own key-press counter (kept in its state), so a replay is identical.

### The look (all upgraded devices: chick, pager, dictionary, calculator, tape)
The hi screen (`HiFrame` on the dark glass) can show Kuro instead of the object's own picture: one of the Kurogotchi frames drawn with `imageSmoothingEnabled = false`, scaled to the glass height, centred (wide screens: pager, calculator, dictionary show it at the left with the rest of the glass dark).
- **1**: after a key press, chance 1/6: Kuro (`blink` or `base`) for 180 ms, then the object's own frame. Nothing else changes.
- **2**: chance 1/3, 600 ms, poses `base` / `talk` / `red` (red 1 in 4 of those); and the function interference below happens with chance 1/3 per use.
- **3**: the screen is Kuro all the time (idle `base`/`blink`, `talk` when it answers, `eat` when fed, `red` 1 in 12); the interference always happens.

### The interference (what the object can no longer do)
- **chick**: feeding at 2 sometimes feeds Kuro instead (screen `eat`, the chick's hunger does not fall); at 3 the chick is gone: every action is answered by Kuro's frames, the menu still works, the chick's own frames never show again.
- **pager**: reading the history at 2 shows one entry (seeded) as `0.7734`; at 3 every entry is `0.7734`, the old messages unreadable. (Upside down it says hELLO: it is Kuro saying it now.)
- **dictionary**: a lookup at 2 sometimes answers with Kuro's idiom of the day (`kuroDay(day).idiom`) instead of the gloss; at 3 always. The same for the workbench's `wb-gloss` tooltip while it is held over a contract (work spec item 7): at 3 the dictionary can no longer catch Kuro's word — it glosses it as the idiom.
- **calculator**: `=` at 2 sometimes shows `OK` (smooth letters) instead of the result; at 3 always `OK`. Turned upside down at 3 it shows Kuro's face, not digits.
- **tape**: the upgraded transcript: at 2 one line (seeded) of each recording reads as Kuro's idiom with the original speaker's name kept; at 3 every line does.

### Files
New `src/world/objects/invasion.ts` (level, chance, Kuro frame loader for canvases); `src/world/objects/program.ts` (env fields); the five programs `chick.ts`, `pager.ts`, `dictionary.ts`, `calculator.ts`, `tape.ts` (their upgraded paths only); `src/world/objects/paint.ts` / `layer.ts` (drawing a Kuro frame into the hi canvas); where the env is built (`held.ts` / `layer.ts`); `src/world/desktop/workbench/work.ts` (`wb-gloss` uses the dictionary's invaded answer). Tests in a new `tests/invasion.test.ts`.

### Tests
- Level: not upgraded → 0 on every day; upgraded on day 6 → 1 on days 6–8, 2 on 9–10, 3 from 11; upgraded on day 14 → 3 on day 16.
- Determinism: the same seed and press counter give the same glimpse / interference; a replay of the same log renders the same frames.
- Each device at 3 shows its interference (chick never draws its own frame; pager history all `0.7734`; dictionary lookup = the idiom; calculator `=` = `OK`; tape transcript lines = the idiom with the speaker kept); at 0 none of it.
- The original (not upgraded) devices and the drawer never call the Kuro frame drawer.
- `wb-gloss` with an invaded (3) dictionary held shows the idiom, not the contract note.
