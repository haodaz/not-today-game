// Work in the work app, home in the home app (desktop-ui correction 2026-11-02, evening; tingtalk
// 2026-11-04). Which app shows a conversation is decided by its recipient id alone: the reply tables
// and their events are untouched. 听听 / TingTalk (DingTalk-like) holds the company's threads; Hi信 /
// Hichat (WeChat-like, the `msgs` app) holds 家里 and 朋友圈.
import { recipientsOn } from "@state/replies/resolve";
import { CLIENT_GROUPS, PARENT_GROUPS } from "@state/replies/table";

export type ThreadApp = "tingtalk" | "msgs";

/** The company's conversations, in 听听, in this order. */
export const WORK_THREADS: readonly string[] = ["boss", "partner", "group", "xiaozhang", "laozhou", ...PARENT_GROUPS];

/** Home in Hi信, in this order: the parents' group, Dad's own chat (author 2026-11-28: 「爸爸单开聊天」), the relatives. */
export const HOME_ORDER: readonly string[] = ["family", "father", "clan"];

/** 朋友圈 in Hi信: not a conversation (no replies, no unread), a feed. */
export const FEED = "feed";

/** The app that shows conversation `id`: the work ones in 听听, every other one in Hi信. */
export function appOfThread(id: string): ThreadApp {
  return WORK_THREADS.includes(id) ? "tingtalk" : "msgs";
}

/** The conversations `app` shows on `day`, in the reply tables' order. */
export function threadsIn(app: ThreadApp, day: number): string[] {
  const ids = recipientsOn(day).filter((id) => appOfThread(id) === app);
  if (app !== "msgs") return ids;
  // Hi信: home first (爸妈, 爸, the relatives), then the clients' project groups (WeChat groups)
  const home = ids.filter((id) => !CLIENT_GROUPS.includes(id));
  const at = (id: string): number => (HOME_ORDER.includes(id) ? HOME_ORDER.indexOf(id) : HOME_ORDER.length);
  return [...home.sort((a, b) => at(a) - at(b)), ...ids.filter((id) => CLIENT_GROUPS.includes(id))];
}
