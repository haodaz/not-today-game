import type { AppRenderers } from "./model";
import { renderBrowser } from "./browser/view";
import { deskPet, renderKuro } from "./kuro/mini";
import { html } from "@world/html";
import { renderMessages, renderTingTalk } from "./messages/view";
import { renderWorkbench } from "./workbench/view";

/** The real app renderers. Hi信 (the personal app) and 听听 (the work conversations) are real (requirements §3, tingtalk 2026-11-04). */
export const desktopApps: AppRenderers = {
  msgs: renderMessages,
  tingtalk: renderTingTalk,
  workbench: (ctx) => renderWorkbench(ctx),
  browser: renderBrowser,
  // guidance R4: the pill and the pet (the one Kuro body on the screen) at the monitor's bottom-right.
  kuro: (ctx) => html`${renderKuro(ctx)}${deskPet(ctx)}`,
};
