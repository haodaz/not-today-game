// game-menu (author 2026-11-25, feedback #80–#87): 人物 · 道具 · 设置 are one menu — the room frosted
// behind it (never a black screen), a frame with the eye on its top edge, the tabs on a glass card on
// the left, the page on a glass card on the right, light text with a soft glow. The look follows the
// day (runes.ts `bandOf`). Each panel keeps its own open flag (statusOpen / itemsOpen / settingsOpen);
// the tabs switch between them (`menu-tab`). Pure markup. Mock: design/game-panels-2026-11-25.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { bandOf, CORNER, eye, medal, ritualCircle, rune, veins, type Rune } from "./runes";

export type MenuTabId = "status" | "items" | "settings";

export interface MenuTab {
  readonly id: MenuTabId;
  readonly rune: Rune;
  readonly label: SafeHtml;
}

/** The room's tabs: 人物, 道具 (once something is found, gates R4), 设置. */
export function roomTabs(found: number, settings = true): MenuTab[] {
  const tabs: MenuTab[] = [{ id: "status", rune: "who", label: tr("hud.status") }];
  if (found > 0) tabs.push({ id: "items", rune: "bag", label: tr("hud.items") });
  if (settings) tabs.push({ id: "settings", rune: "set", label: tr("settings.title") });
  return tabs;
}

export interface MenuShell {
  readonly active: MenuTabId;
  /** The run's day (the look); null on the title page and in the prologue (the eye closed). */
  readonly day: number | null;
  readonly title: SafeHtml;
  readonly rune: Rune;
  /** Empty: no tab column (the title page's settings stand alone). */
  readonly tabs: readonly MenuTab[];
  /** The action a click outside, the × and Esc run. */
  readonly close: string;
  readonly body: SafeHtml;
  /** The pane's own class (status / items / settings) and the dialog's id for its heading. */
  readonly pane: string;
  readonly id: string;
  readonly extra?: string;
}

const CORNERS = (["tl", "tr", "bl", "br"] as const).map((k) => html`<svg class="gm-corner ${k}" viewBox="0 0 64 64" aria-hidden="true">${CORNER}</svg>`);

export function menuShell(m: MenuShell): SafeHtml {
  const band = m.day === null ? "tech" : bandOf(m.day);
  const tabs = m.tabs.length
    ? html`<nav class="gm-tabs" aria-label="${t("hud.menu")}">${m.tabs.map((tb) => html`<button type="button" class="${cls("gm-tab", tb.id === m.active && "on")}" data-action="menu-tab" data-tab="${tb.id}" aria-pressed="${tb.id === m.active ? "true" : "false"}"><i aria-hidden="true"></i>${rune(tb.rune, "gm-tab-rune")}<span>${tb.label}</span></button>`)}<div class="gm-hint"><kbd>Tab</kbd>${tr("hud.menuTab")}</div></nav>`
    : null;
  return html`<div class="${cls("settings-layer", "game-menu", m.tabs.length === 0 && "solo", m.extra)}" data-band="${band}"><button type="button" class="settings-dim gm-veil" data-action="${m.close}" aria-label="${t("status.close")}"></button>${band === "tech" ? null : ritualCircle()}${band === "flesh" ? veins() : null}<div class="gm-frame" aria-hidden="true"><i class="gm-line"></i><i class="gm-line2"></i>${CORNERS}${eye(band)}</div><div class="gm-head">${rune(m.rune, "gm-head-rune")}<b>${m.title}</b></div><button type="button" class="gm-close med" data-action="${m.close}" aria-label="${t("status.close")}" title="${t("status.close")}">${medal("close")}</button>${tabs}<div class="gm-pane pane-${m.pane}" role="dialog" aria-modal="true" aria-labelledby="${m.id}"><h3 id="${m.id}" class="gm-sr">${m.title}</h3>${m.body}</div><div class="gm-esc" aria-hidden="true"><kbd>Esc</kbd>${tr("status.close")}</div></div>`;
}
