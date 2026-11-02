// Work in the work app, home in the home app (desktop-ui correction 2026-11-02, evening). Which app
// shows a conversation is decided by its recipient id alone: the reply tables and their events are
// untouched. 工作台's 消息 pane holds the company's threads; 消息 (WeChat-like) holds 家里 and 朋友圈.
import { recipientsOn } from "@state/replies/resolve";

export type ThreadApp = "workbench" | "msgs";

/** The company's conversations, in 工作台's 消息 pane, in this order. */
export const WORK_THREADS: readonly string[] = ["boss", "partner", "group", "xiaozhang", "laozhou"];

/** 朋友圈 in 消息: not a conversation (no replies, no unread), a feed. */
export const FEED = "feed";

/** The app that shows conversation `id`: the work ones in 工作台, every other one in 消息. */
export function appOfThread(id: string): ThreadApp {
  return WORK_THREADS.includes(id) ? "workbench" : "msgs";
}

/** The conversations `app` shows on `day`, in the reply tables' order. */
export function threadsIn(app: ThreadApp, day: number): string[] {
  return recipientsOn(day).filter((id) => appOfThread(id) === app);
}
