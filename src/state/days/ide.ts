// ide (2026-11-04): the IDE view of a work-v2 board, as pure functions of the log. The preview URL
// (`ideSrc`, R3) and Kuro's transcript (`ideTranscript`, R4) are derived from today's board ops, so
// a reload or a replay shows the same page and the same lines. No new events.
import type { BoardOp, GameEvent } from "@state/events";
import { freshBoard, stepBoard, tuneReached, tuneStepsLeft, tuneValues, type BoardState } from "./board";
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
export function selectedSlot(board: TaskBoard, ops: readonly IdeOp[], chosen: string | null = null): string {
  if (chosen !== null && board.slots.some((s) => s.id === chosen)) return chosen;
  return lastFilled(board, ops) ?? board.slots[0]?.id ?? "";
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

/** A transcript line and the beat it belongs to. */
export interface IdeLine extends BoardBeatLine {
  readonly on: string;
}

/**
 * Kuro's transcript (ide R4): the `open` beat first, then for each op in log order its beat, each
 * beat at most once. A fill of slot S with card C → `fill:S:C` if the board has it, else `fill:S`;
 * Kuro's assist → `kuro`; an unlock (the right code, or Kuro's) → `unlock`; print → `print`; the
 * send → `send`. Ops without a beat (a clear, a wrong code) show nothing. Pure.
 */
export function ideTranscript(board: TaskBoard, ops: readonly IdeOp[], carried: Readonly<Record<string, string>> = {}): IdeLine[] {
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
      case "try":
        if (!walk.tried) show("try");
        break;
      case "mod": {
        // tune: the switch's own beat (on / off) when it took, then `steps` as the budget runs out
        // and `reach` as every bar clears today's line (each once).
        const after = stepBoard(board, walk, op);
        if (after !== walk) {
          show(op.path === null ? `unmod:${op.id}` : beats.has(`mod:${op.id}:${op.path}`) ? `mod:${op.id}:${op.path}` : `mod:${op.id}`);
          if (tuneReached(board, after)) show("reach");
          else if (tuneStepsLeft(board, after) === 0) show("steps");
        }
        break;
      }
      case "fill":
        show(beats.has(`fill:${op.slot}:${op.card}`) ? `fill:${op.slot}:${op.card}` : `fill:${op.slot}`);
        break;
      case "assistFill":
        show("kuro");
        break;
      case "merge": {
        // ide v2: the page's own beat (by what was kept), then `merge` once every differing page is merged.
        show(beats.has(`merge:${op.slot}:${op.keep}`) ? `merge:${op.slot}:${op.keep}` : `merge:${op.slot}`);
        const after = stepBoard(board, walk, op);
        if (Object.keys(board.ide?.diff ?? {}).every((id) => id in after.merged)) show("merge");
        break;
      }
      case "fetch":
        if (!walk.fetched) show("fetch");
        break;
      case "unlock":
        if (!walk.unlocked && op.code === board.given.lock?.answer) show("unlock");
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
