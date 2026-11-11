// ide (2026-11-04): the IDE view of a work-v2 board, as pure functions of the log. The preview URL
// (`ideSrc`, R3) and Kuro's transcript (`ideTranscript`, R4) are derived from today's board ops, so
// a reload or a replay shows the same page and the same lines. No new events.
import type { BoardOp, GameEvent } from "@state/events";
import { compareRight, compareScore, freshBoard, stepBoard, tuneReached, tuneStepsLeft, tuneValues, type BoardState } from "./board";
import type { BoardBeatLine, Task, TaskBoard } from "./tasks";

/** One step the IDE view follows: a board op, the print (the `task` event), or the send (`give`). */
export type IdeOp = BoardOp | { readonly t: "print" } | { readonly t: "send" };

/**
 * Today's ops for a board task in log order (ide R4): its `boardStep` ops, the `task` event that
 * printed it (→ print), and the `give` of its deliverable (→ send). Pure.
 */
export function ideOps(task: Task, day: number, events: readonly GameEvent[]): IdeOp[] {
  const out: IdeOp[] = [];
  const deliverable = task.deliverable?.id;
  for (const e of events) {
    if (e.day !== day) continue;
    if (e.kind === "boardStep" && e.taskId === task.id) out.push(e.op);
    else if (e.kind === "task" && e.flag === task.done && e.slots !== undefined) out.push({ t: "print" });
    else if (e.kind === "give" && deliverable !== undefined && e.deliverableId === deliverable) out.push({ t: "send" });
  }
  return out;
}

/** The query the deliverable reads, before the fill: the IDE's theme and the code pane (ide R2). */
/** The query before the page and the fill (shell R4): the light theme and the preview pane only. */
const IDE_QUERY = "theme=light&pane=preview";
/** tune: from this day on, a tuning board's page opened again reads 100 everywhere and misplays. */
export const HAUNT_FROM = 4;

/**
 * The slot filled last (shell R4's default selection): by the player, or the last slot Kuro filled
 * in its assist; null before any fill. Pure.
 */
export function lastFilled(board: TaskBoard, ops: readonly IdeOp[]): string | null {
  let last: string | null = null;
  let walk = freshBoard(board);
  for (const op of ops) {
    if (op.t === "print" || op.t === "send") continue;
    if (op.t === "fill") last = op.slot;
    else if (op.t === "assistFill") {
      const empty = board.slots.filter((slot) => !(slot.id in walk.slots));
      if (empty.length > 0) last = empty[empty.length - 1]!.id;
    }
    walk = stepBoard(board, walk, op);
  }
  return last;
}

/** The selected slot (shell R2/R4): the chosen one if it is a slot, else the slot filled last, else the first. */
export function selectedSlot(board: TaskBoard, ops: readonly IdeOp[], chosen: string | null = null, chosenAt = Infinity): string {
  if (chosen !== null && board.slots.some((s) => s.id === chosen)) {
    // ide talk (author 2026-11-10): after a choice the code moves on to the next page that still
    // needs one — when an op came after the page was chosen and the chosen page is done.
    if (board.view === "ide" && ops.length > chosenAt) {
      let walk = freshBoard(board);
      for (const op of ops) if (op.t !== "print" && op.t !== "send") walk = stepBoard(board, walk, op);
      if (!workLeft(board, walk, chosen)) return nextWork(board, walk, chosen) ?? chosen;
    }
    return chosen;
  }
  return lastFilled(board, ops) ?? board.slots[0]?.id ?? "";
}

/** ide v2: a page still needs a decision — its v16/v17 difference is not merged, or it is not filled. */
export function workLeft(board: TaskBoard, s: BoardState, slot: string): boolean {
  const diff = board.ide?.diff;
  return (!!diff && slot in diff && !(slot in s.merged)) || !(slot in s.slots);
}

/** The next page (in file order, after `from`, wrapping) that still needs a decision; null when none does. */
export function nextWork(board: TaskBoard, s: BoardState, from: string): string | null {
  const ids = board.slots.map((x) => x.id);
  const i = ids.indexOf(from);
  for (let k = 1; k <= ids.length; k++) {
    const id = ids[(i + k) % ids.length]!;
    if (id !== from && workLeft(board, s, id)) return id;
  }
  return null;
}

/**
 * tune (2026-11-08): the query a tuning board's page reads: `mods` (the modules on, in order),
 * `dims` (each bar now), `base` (each bar when the board opened today), `reach`, `promise`, and
 * `left` (steps left). The page draws the bars itself from these; `print` adds `&done=1`.
 */
function tuneQuery(board: TaskBoard, s: BoardState, carried: Readonly<Record<string, string>>, printed: boolean): string {
  const tune = board.tune!;
  const kv = (v: Readonly<Record<string, number>>) => tune.dims.map((d) => `${encodeURIComponent(d.id)}:${v[d.id] ?? 0}`).join(",");
  const mods = tune.mods.filter((m) => m.id in s.mods).map((m) => `${encodeURIComponent(m.id)}:${encodeURIComponent(s.mods[m.id]!)}`).join(",");
  return `&mods=${mods}&dims=${kv(tuneValues(board, s.mods))}&base=${kv(tuneValues(board, carried))}&reach=${tune.reach}&promise=${tune.promise}&left=${tuneStepsLeft(board, s)}${printed ? "&done=1" : ""}`;
}

/**
 * The preview URL (shell R4): `ide.src` with `theme=light&pane=preview&c=<page>&fill=<slot:card,…>`.
 * `fill` lists every filled slot in slot order (Kuro's cards by their own id) and is always there
 * (`fill=` while nothing is filled); `c` is the page of the selected slot (`selectedSlot`). Pure.
 */
export function ideSrc(board: TaskBoard, s: BoardState, ops: readonly IdeOp[], chosen: string | null = null, carried: Readonly<Record<string, string>> = {}, haunt: number | null = null): string {
  const src = board.ide?.src ?? "";
  const page = board.ide?.pages[selectedSlot(board, ops, chosen)] ?? 0;
  if (board.tune) {
    const sep = src.includes("?") ? "&" : "?";
    // The foreshadowing (author 2026-11-08): the file stays on the player's computer; opened again from
    // day 4 on, every bar reads 100 and the page misplays a little (`&haunt=<day>`; the page does the rest).
    return `${src}${sep}${IDE_QUERY}&c=${page}${tuneQuery(board, s, carried, ops.some((o) => o.t === "print"))}${haunt !== null && haunt >= HAUNT_FROM ? `&haunt=${haunt}` : ""}`;
  }
  const fill = board.slots
    .filter((slot) => slot.id in s.slots)
    .map((slot) => `${encodeURIComponent(slot.id)}:${encodeURIComponent(s.slots[slot.id]!)}`)
    .join(",");
  const sep = src.includes("?") ? "&" : "?";
  // ide v2 (2026-11-08): with an API, the page shows the live numbers until the data was pulled, and the
  // snapshot line once it was printed (the import switched from the API to the snapshot file).
  const data = board.ide?.api ? `&data=${s.fetched ? "fetched" : "live"}${ops.some((o) => o.t === "print") ? "&snap=1" : ""}` : "";
  return `${src}${sep}${IDE_QUERY}&c=${page}&fill=${fill}${data}`;
}

/**
 * compare (author 2026-11-11): the conversation of a compare board. The `open` beat; then per pick the
 * player's line (`compare:cmpPick`, args n / v), Kuro's 渲染好了 and the boss's face in words
 * (`compare:cmpHappy` / `compare:cmpPout`); Kuro's rewrite (`compare:cmpRedo` / `cmpRedone`); when the
 * last page is picked the sum (`compare:cmpSum`, args n / r / w / pct) and pass / fail; the hand-in's
 * `print` beat and Kuro's remark about each chosen card (said after the hand-in, as the author asked);
 * then the `send` beat. The view words the `args` lines through `board.ide.<kind>`.
 */
export function compareTranscript(board: TaskBoard, ops: readonly IdeOp[]): IdeLine[] {
  const cmp = board.compare!;
  const beats = new Map((board.beats ?? []).map((b) => [b.on, b]));
  const out: IdeLine[] = [];
  const show = (on: string) => {
    const beat = beats.get(on);
    if (beat) for (const l of beat.lines) out.push({ on, who: l.who, text: l.text });
  };
  show("open");
  let walk = freshBoard(board);
  const sum = (s: BoardState) => {
    const sc = compareScore(board, s);
    out.push({ on: "compare:cmpSum", who: "kuro", text: "", args: { n: String(sc.total), r: String(sc.right), w: String(sc.total - sc.right), pct: String(sc.pct) } });
    out.push({ on: sc.pct >= cmp.threshold ? "compare:cmpPass" : "compare:cmpFail", who: "kuro", text: "", args: { pct: String(cmp.threshold) } });
  };
  for (const op of ops) {
    if (op.t === "fill") {
      const i = cmp.pages.findIndex((p) => p.slot === op.slot);
      const after = stepBoard(board, walk, op);
      if (i < 0 || after === walk) continue;
      const page = cmp.pages[i]!;
      const v = op.card === page.left ? cmp.versions[0] : cmp.versions[1];
      out.push({ on: "compare:cmpPick", who: "me", text: "", args: { n: String(i + 1), v } });
      out.push({ on: "compare:cmpRendered", who: "kuro", text: "", args: { n: String(i + 1) } });
      out.push({ on: compareRight(board, after.slots, op.slot) ? "compare:cmpHappy" : "compare:cmpPout", who: "kuro", text: "", args: {} });
      walk = after;
      if (cmp.pages.every((p) => p.slot in walk.slots)) sum(walk);
    } else if (op.t === "assistFill") {
      const after = stepBoard(board, walk, op);
      if (after === walk) continue;
      out.push({ on: "compare:cmpRedo", who: "me", text: "", args: {} });
      out.push({ on: "compare:cmpRedone", who: "kuro", text: "", args: {} });
      walk = after;
      sum(walk);
    } else if (op.t === "print") {
      show("print");
      for (const p of cmp.pages) {
        const card = walk.slots[p.slot];
        const remark = card ? p.remark[card] : undefined;
        if (remark) out.push({ on: `remark:${p.slot}`, who: "kuro", text: remark });
      }
    } else if (op.t === "send") show("send");
  }
  return out;
}

/** A transcript line and the beat it belongs to. */
export interface IdeLine extends BoardBeatLine {
  readonly on: string;
  /** ide talk: a worded line (the player's choice, Kuro's execution) — the view fills `board.ide.<kind>` with these. */
  readonly args?: Readonly<Record<string, string>>;
}

/**
 * Kuro's transcript (ide R4): the `open` beat first, then for each op in log order its beat, each
 * beat at most once. A fill of slot S with card C → `fill:S:C` if the board has it, else `fill:S`;
 * Kuro's assist → `kuro`; an unlock (the right code, or Kuro's) → `unlock`; print → `print`; the
 * send → `send`. Ops without a beat (a clear, a wrong code) show nothing. Pure.
 */
export function ideTranscript(board: TaskBoard, ops: readonly IdeOp[], carried: Readonly<Record<string, string>> = {}): IdeLine[] {
  if (board.compare) return compareTranscript(board, ops);
  const beats = new Map((board.beats ?? []).map((b) => [b.on, b]));
  const shown = new Set<string>();
  const out: IdeLine[] = [];
  const show = (on: string) => {
    const beat = beats.get(on);
    if (!beat || shown.has(on)) return;
    shown.add(on);
    for (const l of beat.lines) out.push({ on, who: l.who, text: l.text });
  };
  show("open");
  let walk = freshBoard(board, carried);
  for (const op of ops) {
    switch (op.t) {
      case "keep":
        if (stepBoard(board, walk, op) !== walk) show("keep");
        break;
      case "assistMod":
      case "mod": {
        // tune (author 2026-11-08): a choice is a turn — the player's bubble first (`pick:<module>:<path>`,
        // or `pick:<module>:<path>:kuro` when Kuro picked; its text is the path's label, the view words it),
        // then the path's beat (Kuro's sentence), then — the moment the work is complete — `reach` (every
        // bar over the line) and/or `steps` (the budget spent: the player's words, Kuro's).
        const after = stepBoard(board, walk, op);
        if (after !== walk) {
          const path = op.t === "assistMod" ? board.tune?.assist[op.id] ?? null : op.path;
          if (path !== null) {
            const label = board.tune?.mods.find((m) => m.id === op.id)?.paths.find((p) => p.id === path)?.label ?? path;
            out.push({ on: `pick:${op.id}:${path}${op.t === "assistMod" ? ":kuro" : ""}`, who: "me", text: label });
          }
          show(path === null ? `unmod:${op.id}` : beats.has(`mod:${op.id}:${path}`) ? `mod:${op.id}:${path}` : `mod:${op.id}`);
          // the line crossed is a remark; the budget spent is the end of the work (the player's words) — both can be this choice
          if (tuneReached(board, after)) show("reach");
          if (tuneStepsLeft(board, after) === 0) show("steps");
        }
        break;
      }
      case "fill": {
        // ide talk (author 2026-11-10): the player's choice as the input, Kuro's execution, then the remark —
        // on every board that talks (beats): a file name on an IDE page, the row's label on a table.
        if ((board.view === "ide" || board.beats) && stepBoard(board, walk, op) !== walk) {
          const label = board.slots.find((x) => x.id === op.slot)?.label ?? op.slot;
          const card = board.cards.find((x) => x.id === op.card)?.text ?? op.card;
          const file = board.ide?.files?.[op.slot]?.name;
          out.push({ on: `ide:fill:${op.slot}:${op.card}`, who: "me", text: card, args: { label, card } });
          if (file !== undefined) out.push({ on: `ide:filled:${op.slot}:${op.card}`, who: "kuro", text: file, args: { file } });
          else out.push({ on: `ide:filledSlot:${op.slot}:${op.card}`, who: "kuro", text: label, args: { label } });
        }
        show(beats.has(`fill:${op.slot}:${op.card}`) ? `fill:${op.slot}:${op.card}` : `fill:${op.slot}`);
        break;
      }
      case "assistFill":
        show("kuro");
        if (board.tune) { const after = stepBoard(board, walk, op); if (tuneReached(board, after)) show("reach"); if (tuneStepsLeft(board, after) === 0) show("steps"); }
        break;
      case "merge": {
        // ide v2: the page's own beat (by what was kept), then `merge` once every differing page is merged.
        const after = stepBoard(board, walk, op);
        if (after !== walk) {
          const file = board.ide?.files?.[op.slot]?.name ?? op.slot;
          out.push({ on: `ide:keep:${op.slot}:${op.keep}`, who: "me", text: file, args: { file, v: op.keep } });
          out.push({ on: `ide:kept:${op.slot}:${op.keep}`, who: "kuro", text: op.keep, args: { v: op.keep } });
        }
        show(beats.has(`merge:${op.slot}:${op.keep}`) ? `merge:${op.slot}:${op.keep}` : `merge:${op.slot}`);
        if (Object.keys(board.ide?.diff ?? {}).every((id) => id in after.merged)) show("merge");
        break;
      }
      case "fetch":
        if (!walk.fetched) {
          const at = board.ide?.api?.at ?? "";
          out.push({ on: "ide:pull", who: "me", text: at, args: {} });
          out.push({ on: "ide:pulled", who: "kuro", text: at, args: { at } });
          show("fetch");
        }
        break;
      case "unlock":
        if (!walk.unlocked && op.code === board.given.lock?.answer) {
          // ide talk: the code the player typed, Kuro opening the lock, then the unlock beat
          if (board.beats) {
            out.push({ on: `ide:code:${op.code}`, who: "me", text: op.code, args: { code: op.code } });
            out.push({ on: "ide:opened", who: "kuro", text: op.code, args: {} });
          }
          show("unlock");
        }
        break;
      case "assistUnlock":
        if (!walk.unlocked) show("unlock");
        break;
      case "print":
        show("print");
        break;
      case "send":
        show("send");
        break;
    }
    if (op.t !== "print" && op.t !== "send") walk = stepBoard(board, walk, op);
  }
  return out;
}
