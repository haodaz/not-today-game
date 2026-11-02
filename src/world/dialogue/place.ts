// Where the player is, for the box (dialogue addition 2026-11-02, "a line waits for its place").
// The view, the app in front on the monitor being shown, the conversation or 工作台 page open there
// (the third level), and whether it is night. The Kuro chat overlay is not a place: it does not
// change the view. Pure, apart from `settleSession`, which writes the session's dialogue (session
// only; nothing here is an event).
import { isNight } from "@world/desktop/beat";
import { frontApp, shownConversation, type Session } from "@world/desktop/model";
import { settle, type Here } from "@world/loop/dialogue";

export function hereOf(s: Pick<Session, "view" | "focus" | "leftApp" | "clock" | "workbenchPage" | "conversation" | "homeConversation">): Here {
  const app = frontApp(s);
  return {
    // 床 is the room seen from the bed: a line for the room plays there too.
    view: s.view === "bed" ? "room" : s.view,
    // Either monitor: the one being shown has the app in front.
    app,
    night: isNight(s.clock),
    conversation: shownConversation(s),
    page: app === "workbench" ? s.workbenchPage : null,
  };
}

/** Brings the session's dialogue in line with where the player is; true if anything moved. */
export function settleSession(s: Session): boolean {
  const next = settle(s.dialogue, hereOf(s));
  if (next === s.dialogue) return false;
  s.dialogue = next;
  return true;
}
