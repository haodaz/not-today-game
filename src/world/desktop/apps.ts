// The app renderers the desktop uses. Each app module plugs in here as it is built.
import { html } from "@world/html";
import { renderKuro } from "./kuro/mini";
import { renderMessages } from "./messages/view";
import type { AppRenderers } from "./model";

export const desktopApps: AppRenderers = {
  msgs: renderMessages,
  workbench: () => ({ body: html`<div class="body"></div>`, badge: 0, tag: null }),
  browser: () => ({ body: html`<div class="body"></div>`, bar: html`<div class="url"></div>`, badge: 0 }),
  kuro: renderKuro,
};
