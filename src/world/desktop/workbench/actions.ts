// 工作台 actions. Only navigation changes anything for now: the work tasks (modes, 看一眼, 让它合并…)
// are hand-written trees in content/tasks/, which does not exist yet; their buttons are inert hooks.
import type { ActionHandler } from "../controller";
import type { WorkbenchPage } from "../model";

const PAGES: readonly WorkbenchPage[] = ["home", "docs", "ledger", "code", "msgs"];

export const workbenchActions: Record<string, ActionHandler> = {
  "wb-nav"(ctx, data) {
    const page = data.page as WorkbenchPage;
    if (!PAGES.includes(page)) return;
    ctx.session.workbenchPage = page;
    ctx.rerender();
  },
};
