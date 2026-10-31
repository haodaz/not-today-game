// Test helper (not a test file): the dialogue box on every screen of the line on show, joined, so a
// test can see a line and its choices even when they sit on different pages (dialogue FR1).
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { dialogueBox, lineScreens } from "@world/dialogue/box";

export function everyScreen(state: State, session: Session, events: readonly GameEvent[] = []): string {
  const saved = session.dialogue;
  const n = lineScreens(state, session)?.all.length ?? 1;
  const out: string[] = [];
  for (let page = 0; page < n; page++) {
    session.dialogue = { ...saved, page };
    out.push(dialogueBox(state, events, session)?.value ?? "");
  }
  session.dialogue = saved;
  return out.join("\n");
}
