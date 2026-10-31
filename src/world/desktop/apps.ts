// The app renderers the desktop uses. Each app module plugs in here as it is built.
import { renderBrowser } from "./browser/view";
import { renderKuro } from "./kuro/mini";
import { renderMessages } from "./messages/view";
import { renderWorkbench } from "./workbench/view";
import type { AppRenderers } from "./model";

export const desktopApps: AppRenderers = {
  msgs: renderMessages,
  workbench: (ctx) => renderWorkbench(ctx),
  browser: renderBrowser,
  kuro: renderKuro,
};
