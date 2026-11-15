// meters-v2 §1: one rule for every game at the print site — the board's game names its engine, the
// engine's `grade()` reads the final play in the session and what spans the attempts (the tally).
// The tally is kept by `noteTally`, called around every board action (board.ts's wrapper).
import type { BoardVerdict } from "@state/days/board";
import type { GameEvent } from "@state/events";
import type { TaskBoard } from "@state/days/tasks";
import type { Session } from "../model";
import { grade as fillGrade, fillRecord } from "./fill";
import { grade as gachaGrade } from "./gacha";
import { grade as linkGrade } from "./link";
import { grade as match3Grade } from "./match3";
import { grade as minesGrade } from "./mines";
import { grade as molesGrade } from "./moles";
import { grade as pacGrade } from "./pacman";
import { grade as pipesGrade } from "./pipes";
import { grade as rhythmGrade } from "./rhythm";
import { grade as snakeGrade } from "./snake";
import { grade as sokobanGrade } from "./sokoban";
import { grade as spotGrade } from "./spot";
import { grade as stackGrade } from "./stack-stage";
import { grade as tetrisGrade } from "./tetris";
import { freshTally, type GameTally } from "./tally";

/** The session field each action prefix plays in (the chain's actions are `stack-*`). */
const FIELD: Readonly<Record<string, keyof Session>> = {
  link: "link", match3: "match3", snake: "snake", pacman: "pacman", mines: "mines", sokoban: "sokoban", tetris: "tetris",
  pipes: "pipes", moles: "moles", rhythm: "rhythm", gacha: "gacha", stack: "chain", fill: "fill",
};

const own = <T extends { key: string }>(g: T | null | undefined, taskId: string): T | null => (g && g.key === taskId ? g : null);

/**
 * The grade of the play on this board now, or null: a board with no game, or a game whose session is
 * gone (a reload after the win: the night's judgement then reads no `quality`, as before this spec).
 * fill keeps its record in the log, so a reload still grades it.
 */
export function gradeGame(board: TaskBoard, taskId: string, day: number, session: Session, events: readonly GameEvent[] = []): BoardVerdict | null {
  const t = session.gameTally?.key === taskId ? session.gameTally : null;
  if (board.stack) {
    const g = own(session.chain, taskId);
    return g ? stackGrade(g, t) : null;
  }
  const game = board.game;
  if (!game) return null;
  switch (game.kind) {
    case "link": { const g = own(session.link, taskId); return g ? linkGrade(g, t) : null; }
    case "match3": { const g = own(session.match3, taskId); return g ? match3Grade(g, t) : null; }
    case "snake": { const g = own(session.snake, taskId); return g ? snakeGrade(g, t) : null; }
    case "pacman": { const g = own(session.pacman, taskId); return g ? pacGrade(g, t) : null; }
    case "mines": { const g = own(session.mines, taskId); return g ? minesGrade(g, t) : null; }
    case "sokoban": { const g = own(session.sokoban, taskId); return g ? sokobanGrade(g, game, t) : null; }
    case "tetris": { const g = own(session.tetris, taskId); return g ? tetrisGrade(g, t) : null; }
    case "pipes": { const g = own(session.pipes, taskId); return g ? pipesGrade(g, t) : null; }
    case "moles": { const g = own(session.moles, taskId); return g ? molesGrade(g, t) : null; }
    case "rhythm": { const g = own(session.rhythm, taskId); return g ? rhythmGrade(g, t) : null; }
    case "gacha": { const g = own(session.gacha, taskId); return g ? gachaGrade(g, t) : null; }
    case "spot": return session.spotMiss?.key === `${String(day)}:${taskId}` ? spotGrade(session.spotMiss, t) : spotGrade(null, t);
    case "fill": {
      const g = own(session.fill, taskId);
      if (g) return fillGrade(g);
      const rec = fillRecord(events, day, taskId);
      return rec ? (rec.kuro ? "wrong" : "perfect") : null;
    }
    default: return null;
  }
}

/**
 * Around a board action: a start after a loss is a fail, every start a pull, 让克总帮忙 marks the
 * tally, a link pair that did not join is a mistake. `before` is the game's session before the action.
 */
export function noteTally(session: Session, taskId: string, action: string, before: unknown, data: DOMStringMap): void {
  const prefix = action.split("-")[0]!;
  const field = FIELD[prefix];
  if (!field) return;
  const t: GameTally = session.gameTally?.key === taskId ? session.gameTally : freshTally(taskId);
  const prev = before as { key?: string; over?: boolean; pick?: number | null; left?: number } | null;
  const was = prev && prev.key === taskId ? prev : null;
  const now = session[field] as { key?: string; pick?: number | null; left?: number; aware?: unknown } | null;
  let next = t;
  if (action.endsWith("-start")) next = { ...next, starts: next.starts + 1, fails: next.fails + (was?.over ? 1 : 0) };
  if (action.endsWith("-assist")) next = { ...next, assisted: true };
  // a second tile that did not join (the board's own surprise — the pair turning back — is not the player's)
  if (action === "link-tap" && was && now && now !== before && was.pick !== null && was.pick !== undefined && String(was.pick) !== data.i && now.left === was.left && !now.aware) next = { ...next, mistakes: next.mistakes + 1 };
  if (next !== t || session.gameTally?.key !== taskId) session.gameTally = next;
}

/** The session field an action plays in (for the wrapper to read `before`). */
export const tallyField = (action: string): keyof Session | null => FIELD[action.split("-")[0]!] ?? null;
