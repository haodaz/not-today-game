// The dialogue box (dialogue FR1, mock design/chrome/dialogue.html): one fixed box, bottom centre,
// three rows; a name tag on its top-left edge; ↺ history on its top-right; long text paged with ▼,
// ▶ on the last page; choices inside the box. Kuro's lines carry its face in the tag, and its turn
// raises the player's box from the right edge (FR2). Pure: state + session in, markup out. Every
// text is content's or a string.
import type { GameEvent } from "@state/events";
import { isRaidNight } from "@state/nights";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { cls, html, type SafeHtml } from "@world/html";
import { getLocale, hasString, t } from "@world/i18n";
import { showing } from "@world/loop/dialogue";
import { fillPlaceholders } from "@world/replies/placeholders";
import { historyEntries, renderHistory } from "./history";
import { KURO_AVATAR, playerBox, type PlayerBoxModel } from "./kuro";
import { choiceScreens, fontPx, LINE_BOX, marker, screens, type Screen } from "./layout";

/** The raid is in the dialogue box: tonight's shutdown sequence on a raid night. */
export function raidShowing(state: State, session: Pick<Session, "dialogue">): boolean {
  return isRaidNight(state.day) && session.dialogue.queue[0]?.key === `d${state.day}:beat:shutdown`;
}

export type BoxTag = { readonly kind: "who"; readonly text: string } | { readonly kind: "kuro" } | null;

export interface BoxChoice {
  readonly index: number;
  readonly choice?: string;
  readonly label: string;
}

export interface LineBoxModel {
  readonly kind: "line" | "inner" | "sfx";
  readonly tag: BoxTag;
  /** This screen's page of text ("" on a choices-only screen). */
  readonly text: string;
  readonly choices: readonly BoxChoice[];
  readonly marker: "more" | "next" | null;
  /** ▼ on a choice screen is its own button (the next page of choices). */
  readonly markerClickable: boolean;
  readonly screen: number;
  readonly count: number;
  /** The player's box is up: this one moves above it. */
  readonly raised: boolean;
}

/**
 * Narration's tag: where it is said (门外 at the door, 缝里 during the raid, 桌上 at the desk),
 * when content has given those strings (`dialogue.tag.*`); otherwise none.
 */
function placeTag(state: State, session: Session): BoxTag {
  const key = raidShowing(state, session) ? "dialogue.tag.gap" : session.view === "door" ? "dialogue.tag.door" : session.view === "desk" ? "dialogue.tag.desk" : null;
  return key && hasString(key) ? { kind: "who", text: t(key) } : null;
}

/** The current line's screens and which one shows; null when the box is closed. */
export function lineScreens(state: State, session: Session): { readonly all: readonly Screen[]; readonly page: number } | null {
  const show = showing(session.dialogue, state);
  if (!show) return null;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const labels = show.choices?.map((c) => (c.text !== null ? fill(c.text) : t(c.labelKey!))) ?? null;
  const all = screens(show.line ? fill(show.line.t) : null, labels, LINE_BOX, fontPx(getLocale()));
  return { all, page: Math.min(Math.max(0, session.dialogue.page ?? 0), all.length - 1) };
}

export function lineBoxModel(state: State, events: readonly GameEvent[], session: Session): LineBoxModel | null {
  const show = showing(session.dialogue, state);
  const at = lineScreens(state, session);
  if (!show || !at) return null;
  const head = session.dialogue.queue[0]!;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const scr = at.all[at.page]!;
  const line = show.line;
  const kind = line?.k === "inner" ? "inner" : line?.k === "sfx" ? "sfx" : "line";
  const tag: BoxTag =
    head.voice === "kuro" ? { kind: "kuro" } : !line || kind !== "line" ? null : line.k === "speaker" ? { kind: "who", text: fill(line.who ?? "") } : placeTag(state, session);
  const choices = scr.choices.map((i): BoxChoice => {
    const c = show.choices![i]!;
    return { index: c.index, choice: c.choice, label: c.text !== null ? fill(c.text) : t(c.labelKey!) };
  });
  const mk = marker(at.all, at.page);
  return {
    kind,
    tag,
    text: scr.text,
    choices,
    marker: mk,
    markerClickable: scr.choices.length > 0 && mk === "more",
    screen: at.page,
    count: at.all.length,
    raised: playerBox(state, events, session) !== null,
  };
}

function tagOf(tag: BoxTag): SafeHtml | null {
  if (!tag) return null;
  if (tag.kind === "kuro") return html`<span class="who tag k"><img src="${KURO_AVATAR}" alt="">${t("kuro.name")}</span>`;
  return tag.text ? html`<span class="who tag">${tag.text}</span>` : null;
}

const historyChip = (): SafeHtml => html`<button type="button" class="hist" data-action="dlg-history" aria-haspopup="dialog" aria-label="${t("dialogue.history")}">↺</button>`;

export function renderLineBox(m: LineBoxModel): SafeHtml {
  // The whole text area reads on (a click completes a line still appearing first, polish FR3).
  const txt = m.text || !m.choices.length ? html`<button type="button" class="txt" data-action="loop-advance">${m.text}</button>` : null;
  const buttons = m.choices.map(
    (c) => html`<button type="button" data-action="loop-choice" data-index="${c.index}"${c.choice ? html` data-choice="${c.choice}"` : null}>${c.label}</button>`,
  );
  const glyph = m.marker === "more" ? "▼" : "▶";
  const mk = !m.marker
    ? null
    : m.markerClickable
      ? html`<button type="button" class="more" data-action="loop-advance">${glyph}</button>`
      : html`<span class="more" aria-hidden="true">${glyph}</span>`;
  // A tag on the top edge pushes the text down below it (`tagged`; Kuro's face needs more room).
  const tag = tagOf(m.tag);
  const c = cls("dlg", m.kind !== "line" && m.kind, tag && "tagged", m.tag?.kind === "kuro" && "kuro", m.choices.length > 0 && "has-choices", m.raised && "raised");
  return html`<div class="${c}" data-screen="${m.screen + 1}/${m.count}">${tag}${historyChip()}${txt}${m.choices.length ? html`<div class="choices">${buttons}</div>` : null}${mk}</div>`;
}

/** The player's box: the starter questions as choices, or one text input (Enter sends). */
export function renderPlayerBox(p: PlayerBoxModel): SafeHtml {
  const tag = p.name ? html`<span class="who tag p">${p.name}</span>` : null;
  if (p.mode === "input") {
    return html`<div class="dlg-player input" data-mode="input">${tag}<input class="kuro-in" type="text" data-input="kuro-text" data-focus="kuro-text" data-enter="kuro-send" maxlength="500" value="${p.draft}" aria-label="${t("dialogue.more")}" autocomplete="off" spellcheck="false"></div>`;
  }
  const scr = p.screens[p.page];
  const buttons = (scr?.choices ?? []).map((i) => {
    const o = p.options[i]!;
    return html`<button type="button" data-action="${o.action}"${o.q !== undefined ? html` data-q="${o.q}"` : null}>${o.label}</button>`;
  });
  const more = choiceScreens(p.screens).length > 1 ? html`<button type="button" class="more" data-action="kuro-page">▼</button>` : null;
  return html`<div class="dlg-player" data-mode="choices" data-screen="${p.page + 1}/${p.screens.length}">${tag}<div class="choices">${buttons}</div>${more}</div>`;
}

/** Everything the box shows now: the line box, the player's box, the history panel. */
export function dialogueBox(state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  const line = lineBoxModel(state, events, session);
  const player = playerBox(state, events, session);
  const hist = session.historyOpen ? renderHistory(historyEntries(session, state)) : null;
  if (!line && !player && !hist) return null;
  return html`${line ? renderLineBox(line) : null}${player ? renderPlayerBox(player) : null}${hist}`;
}
