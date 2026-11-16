// game-sfx (2026-11-16): the work games' sounds on the chip. One pure rule for every game: the sound
// of a game's session state going from `before` to `after` (the tables in the spec), or null. board.ts
// calls it wherever a game's session field is replaced — the action wrapper, the clocks' steps, the
// start and assist presses — so a line cleared by gravity sounds like one cleared by a key. It never
// reads the DOM and never throws on a null side.
import type { Session } from "../model";
import type { ChipId } from "@world/sound/chip";
import type { FillGame } from "./fill";
import type { GachaGame } from "./gacha";
import type { LinkGrid } from "./link";
import type { Match3Grid } from "./match3";
import type { MinesGrid } from "./mines";
import type { MolesGame } from "./moles";
import type { PacGame } from "./pacman";
import { flow, pipesLeaks, type PipesGrid } from "./pipes";
import type { RhythmGame } from "./rhythm";
import type { SnakeGrid } from "./snake";
import { onMarks, type SokobanGame } from "./sokoban";
import type { SpotMiss } from "./spot";
import type { TetrisGame } from "./tetris";

/**
 * Where the change came from. `via: "clock"` is a timer's step (gravity, the snake's step, the sweep):
 * it never sounds `tick` — a step that only moved something is silent. `action` and `data` are the
 * press, for the two moments the state alone cannot tell: match3's swap that cleared nothing (the
 * same state as a deselect) and moles' tap on an empty hole (the engine returns the game unchanged).
 */
export interface GameChipFrom {
  readonly via?: "action" | "clock";
  readonly action?: string;
  readonly data?: DOMStringMap;
}

/** mines: the mine's `wrong`, then the loss this long after. */
export const MINES_LOSE_AFTER_MS = 150;

type Keyed = { readonly key: string };

/** The end of a game beats a match: clear / win / lose are returned before anything else. */
export function gameChip(field: keyof Session, before: unknown, after: unknown, from: GameChipFrom = {}): ChipId | null {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Keyed;
  const a = after as Keyed;
  if (b.key !== a.key) return null;
  const keys = from.via !== "clock";
  const tick = (moved: boolean): ChipId | null => (keys && moved ? "tick" : null);
  if (b === a) {
    // the two presses whose effect is "nothing changed"
    if (field === "moles" && from.action === "moles-tap") {
      const g = a as unknown as MolesGame;
      return g.running && !g.done && !g.over && Number(from.data?.seat) !== g.special ? "wrong" : null;
    }
    return null;
  }
  switch (field) {
    case "link": {
      const x = b as unknown as LinkGrid, y = a as unknown as LinkGrid;
      if (y.done && !x.done) return "clear";
      if (y.left < x.left) return "match";
      if (y.aware && !x.aware) return "wrong";
      if (y.shuffles !== x.shuffles) return null;
      // a second tile that did not join: the pick moves to it (the tally's mistake)
      if (x.pick !== null && y.pick !== null && y.pick !== x.pick) return "wrong";
      return tick(y.pick !== x.pick);
    }
    case "match3": {
      const x = b as unknown as Match3Grid, y = a as unknown as Match3Grid;
      if (y.won && !x.won) return "clear";
      if (y.over && !x.over) return "lose";
      if (y.cleared > x.cleared) return "match";
      // pick → null on the same cells: a swap that matched nothing, unless the same tile was tapped (a deselect)
      if (x.pick !== null && y.pick === null && y.cells === x.cells) return from.data?.i !== undefined && from.data.i === String(x.pick) ? tick(true) : "wrong";
      return tick(y.pick !== x.pick);
    }
    case "snake": {
      const x = b as unknown as SnakeGrid, y = a as unknown as SnakeGrid;
      if (y.done && !x.done) return "clear";
      if (y.over && !x.over) return "lose";
      if (y.want > x.want) return "match";
      return tick(y.next !== x.next);
    }
    case "pacman": {
      const x = b as unknown as PacGame, y = a as unknown as PacGame;
      if (y.done && !x.done) return "clear";
      if (y.over && !x.over) return "lose";
      const eaten = (g: PacGame) => g.lines.filter((v) => v === -1).length;
      if (eaten(y) > eaten(x)) return "match";
      return tick(y.you.next !== x.you.next || y.you.dir !== x.you.dir);
    }
    case "mines": {
      const x = b as unknown as MinesGrid, y = a as unknown as MinesGrid;
      if (y.won && !x.won) return "clear";
      // the mine: `wrong` now; the loss follows (`gameChipAfter`)
      if (y.over && !x.over) return "wrong";
      return tick(y.opened !== x.opened || y.flags !== x.flags);
    }
    case "sokoban": {
      const x = b as unknown as SokobanGame, y = a as unknown as SokobanGame;
      if (y.done && !x.done) return "clear";
      const on = onMarks(y) - onMarks(x);
      if (on > 0) return "match";
      if (on < 0) return "wrong";
      return tick(y.moves !== x.moves);
    }
    case "tetris": {
      const x = b as unknown as TetrisGame, y = a as unknown as TetrisGame;
      if (y.done && !x.done) return "clear";
      if (y.over && !x.over) return "lose";
      // one match per clear, however many lines it took
      if (y.lines > x.lines) return "match";
      const moved = y.spawned !== x.spawned || !samePiece(x.piece, y.piece);
      return tick(moved);
    }
    case "pipes": {
      const x = b as unknown as PipesGrid, y = a as unknown as PipesGrid;
      if (y.done && !x.done) return "clear";
      // the flow reaching a new tile is the news; a leak that came without it is the mistake
      if (flow(y).size > flow(x).size) return "match";
      if (pipesLeaks(y) > pipesLeaks(x)) return "wrong";
      return tick(y.turns !== x.turns);
    }
    case "moles": {
      const x = b as unknown as MolesGame, y = a as unknown as MolesGame;
      if (y.done && !x.done) return "clear";
      if (y.over && !x.over) return "lose";
      const hits = (g: MolesGame) => g.pops.filter((p) => p.hit).length;
      if (hits(y) > hits(x)) return "match";
      return null;
    }
    case "rhythm": {
      const x = b as unknown as RhythmGame, y = a as unknown as RhythmGame;
      if (y.done && !x.done) return "clear";
      if (y.over && !x.over) return "lose";
      if (y.last && y.last !== x.last && (!x.last || y.last.at !== x.last.at || y.last.kind !== x.last.kind)) return y.last.kind === "good" ? "match" : "wrong";
      return null;
    }
    case "gacha": {
      const x = b as unknown as GachaGame, y = a as unknown as GachaGame;
      // the one capsule a game opens is the last: its opening ends the game
      if (y.opened && !x.opened) return "clear";
      return tick(y.turnedAt !== null && x.turnedAt === null);
    }
    case "spotMiss": {
      const x = b as unknown as SpotMiss, y = a as unknown as SpotMiss;
      return y.n > x.n ? "wrong" : null;
    }
    case "fill": {
      const x = b as unknown as FillGame, y = a as unknown as FillGame;
      if (y.done && !x.done) return "clear";
      if (y.round > x.round) return "match";
      return tick(y.pick !== x.pick && !samePick(x.pick, y.pick));
    }
    case "chain": {
      const x = b as unknown as NonNullable<Session["chain"]>, y = a as unknown as NonNullable<Session["chain"]>;
      if (y.approvedAt !== undefined && x.approvedAt === undefined) return "win";
      if (y.over && !x.over) return "lose";
      if (y.moves > x.moves && (y.score > x.score || (y.merged ?? []).some(Boolean))) return "match";
      return tick(y.moves > x.moves);
    }
    default:
      return null;
  }
}

/** The second sound a change carries, played `MINES_LOSE_AFTER_MS` later: only the mine's loss. */
export function gameChipAfter(field: keyof Session, before: unknown, after: unknown): ChipId | null {
  if (field !== "mines" || !before || !after || before === after) return null;
  const x = before as MinesGrid, y = after as MinesGrid;
  return x.key === y.key && y.over && !x.over ? "lose" : null;
}

/** spot: a difference found is a pick on the compare board, not a session field; the last one clears. */
export const spotFoundChip = (allFound: boolean): ChipId => (allFound ? "clear" : "match");

/** An assist that ends the game is Kuro's: `heal`, never the player's `clear` / `win`. */
export const assistChip = (id: ChipId | null): ChipId | null => (id === "clear" || id === "win" ? "heal" : id);

function samePiece(p: TetrisGame["piece"], q: TetrisGame["piece"]): boolean {
  if (p === q) return true;
  if (!p || !q) return false;
  return p.kind === q.kind && p.rot === q.rot && p.x === q.x && p.y === q.y;
}

function samePick(p: FillGame["pick"], q: FillGame["pick"]): boolean {
  if (p === q) return true;
  if (!p || !q || p.kind !== q.kind) return false;
  return p.kind === "piece" ? p.tray === (q as typeof p).tray : p.person === (q as typeof p).person;
}
