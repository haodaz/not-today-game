// Work in the work app, home in the home app (desktop-ui correction 2026-11-02, evening; tingtalk
// 2026-11-04). Which app shows a conversation is decided by its recipient id alone: the reply tables
// and their events are untouched. 听听 / TingTalk (DingTalk-like) holds the company's threads; Hi信 /
// Hichat (WeChat-like, the `msgs` app) holds 家里 and 朋友圈.
import { recipientsOn } from "@state/replies/resolve";

export type ThreadApp = "tingtalk" | "msgs";

/** The company's conversations, in 听听, in this order. */
export const WORK_THREADS: readonly string[] = ["boss", "partner", "group", "xiaozhang", "laozhou"];

/** 朋友圈 in Hi信: not a conversation (no replies, no unread), a feed. */
export const FEED = "feed";

/** The app that shows conversation `id`: the work ones in 听听, every other one in Hi信. */
export function appOfThread(id: string): ThreadApp {
  return WORK_THREADS.includes(id) ? "tingtalk" : "msgs";
}

/** The conversations `app` shows on `day`, in the reply tables' order. */
export function threadsIn(app: ThreadApp, day: number): string[] {
  return recipientsOn(day).filter((id) => appOfThread(id) === app);
}
