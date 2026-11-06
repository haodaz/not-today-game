// The dialogue box (dialogue FR1, mock design/chrome/dialogue.html): one fixed box, bottom centre,
// three rows; a name tag on its top-left edge; ↺ history on its top-right; long text paged with ▼,
// ▶ on the last page; choices inside the box. When Kuro speaks, its portrait stands at the box's
// right end (the one animated body, moved here from the HUD) and the tag carries only its name;
// once its turn line is read the same box is the player's turn (playtest-1105 R6; no second box). Pure: state + session in, markup
// out. Every text is content's or a string.
import type { GameEvent } from "@state/events";
import { isRaidNight } from "@state/nights";
import { dreamNights } from "@state/stages";
import { npcPortrait, silhouetteFor, speakerLabel } from "@world/npc";
/** opening R2: the prologue's sequence key (world/opening.ts; repeated to keep the box free of that module). */
const PROLOGUE_KEY = "prologue";
import type { State } from "@state/types.gen";
import { isNight } from "@world/desktop/beat";
import type { BodyState } from "@world/desktop/kuro/body";
import { kuroBodyState } from "@world/desktop/kuro/mini";
import type { Session } from "@world/desktop/model";
import { cls, html, type SafeHtml } from "@world/html";
import { getLocale, hasString, t } from "@world/i18n";
import { showing, type Queued } from "@world/loop/dialogue";
import { lineKey, revealBusy } from "@world/motion/reveal";
import { fillPlaceholders } from "@world/replies/placeholders";
import { historyEntries, renderHistory } from "./history";
import { playerBox, type PlayerBoxModel } from "./kuro";
import { pointerCls } from "@world/room/pointer";
import { lateRing } from "@world/late/rings";
import { inFace, kuroVoice, type KuroFace } from "@world/desktop/kuro/voice";
import { choiceScreens, fontPx, KURO_LINE_BOX, LINE_BOX, marker, screens, type BoxGeom, type Screen } from "./layout";

/**
 * Lines with a portrait at the box's right end are laid out left of it: Kuro's lines, and the
 * player's inner lines (dialogue addition 2026-11-01). Same slot, same size.
 */
export const geomFor = (q: Queued | undefined, lineKind?: string): BoxGeom => (q?.voice === "kuro" || lineKind === "inner" ? KURO_LINE_BOX : LINE_BOX);

/** The night beat of a dream night (stages.json `dreamNights`): inner lines are the child's. */
export const isDreamNight = (day: number, beat: string): boolean => beat === "night" && dreamNights.includes(day);

/**
 * The player's portrait for inner lines (dialogue addition 2026-11-01): a still, faceless bust by
 * the title card's pronoun answer (她 she / 他 he / 不说 none); the child's on dream nights.
 */
export function playerPortraitSrc(pronoun: State["names"]["pronoun"], dream: boolean): string {
  return `/player/${pronoun ?? "none"}${dream ? "_kid" : ""}.png`;
}

/**
 * The portrait's state (dialogue correction 2026-11-01): busy while its line is appearing, else
 * the body's own state (so it blinks while idle, rests at night).
 */
export function portraitState(state: State, events: readonly GameEvent[], session: Session, nowMs: number): BodyState {
  const r = session.reveal;
  if (r && r.key === lineKey(session.dialogue) && revealBusy(r, nowMs)) return "busy";
  return kuroBodyState({ state, events, startDay: 1, session, night: isNight(session.clock), nowMs });
}

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
  /** Kuro is speaking: its portrait stands at the box's right end, in this state. */
  readonly portrait: BodyState | null;
  /** An NPC portrait for a speaker line (npc.json), in the same slot and size as Kuro's (never with Kuro's or the player's). */
  readonly npcPortrait: string | null;
  /** An inner line: the player's still portrait in the same slot (never with Kuro's or the NPC's). */
  readonly playerPortrait: string | null;
  /** The one-time pointer on these choices (the first night's hand), or none. */
  readonly pointer: string | false;
  /** Red eyes on the portrait (late-days FR2). */
  readonly red: boolean;
  /** kuro-zh-answers R4: Kuro's (or 屏幕's) line in its face: the idiom, or uncanny; null otherwise. */
  readonly face?: KuroFace;
}

/** Kuro speaks this line: its own conversation, or a day line said by 屏幕 (kuro-zh-answers R4). */
function kuroSpeaks(head: Queued | undefined, line: { readonly k: string; readonly who?: string } | null | undefined): boolean {
  if (!line || line.k !== "speaker") return false;
  return head?.voice === "kuro" || line.who === "屏幕";
}

/** The line's text as the box pages it: filled, and for Kuro the `~ ` marker stripped. */
function lineText(state: State, head: Queued | undefined, line: { readonly k: string; readonly who?: string; readonly t: string }): { text: string; face: KuroFace } {
  const filled = fillPlaceholders(line.t, state.names);
  if (!kuroSpeaks(head, line)) return { text: filled, face: null };
  const v = kuroVoice(state.day, filled);
  return { text: v.text, face: v.face };
}

/**
 * Narration's tag: where it is said (门外 at the door, 缝里 during the raid, 桌上 at the desk),
 * when content has given those strings (`dialogue.tag.*`); otherwise none.
 */
function placeTag(state: State, session: Session): BoxTag {
  // opening R2: the prologue's narration is said nowhere in the room (no 桌上 tag).
  if (session.dialogue.queue[0]?.key === PROLOGUE_KEY) return null;
  const key = raidShowing(state, session) ? "dialogue.tag.gap" : session.view === "door" ? "dialogue.tag.door" : session.view === "desk" ? "dialogue.tag.desk" : null;
  return key && hasString(key) ? { kind: "who", text: t(key) } : null;
}

/** The current line's screens and which one shows; null when the box is closed. */
export function lineScreens(state: State, session: Session, events?: readonly GameEvent[]): { readonly all: readonly Screen[]; readonly page: number } | null {
  const show = showing(session.dialogue, state, events);
  if (!show) return null;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const labels = show.choices?.map((c) => (c.text !== null ? fill(c.text) : t(c.labelKey!))) ?? null;
  const all = screens(show.line ? lineText(state, session.dialogue.queue[0], show.line).text : null, labels, geomFor(session.dialogue.queue[0], show.line?.k), fontPx(getLocale()));
  return { all, page: Math.min(Math.max(0, session.dialogue.page ?? 0), all.length - 1) };
}

export function lineBoxModel(state: State, events: readonly GameEvent[], session: Session, nowMs = 0): LineBoxModel | null {
  const show = showing(session.dialogue, state, events);
  const at = lineScreens(state, session, events);
  if (!show || !at) return null;
  const head = session.dialogue.queue[0]!;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const scr = at.all[at.page]!;
  const line = show.line;
  const kind = line?.k === "inner" ? "inner" : line?.k === "sfx" ? "sfx" : "line";
  const tag: BoxTag =
    head.voice === "kuro" ? { kind: "kuro" } : !line || kind !== "line" ? null : line.k === "speaker" ? { kind: "who", text: speakerLabel(line.who ?? "", fill) } : placeTag(state, session);
  // world-prompts R2: on the choices the box keeps the line's last page of text; every choice (all
  // their pages at once) goes to the column on the right, in content order.
  const onChoices = scr.choices.length > 0;
  const textScr = onChoices ? at.all.slice(0, at.page + 1).reverse().find((s) => s.text) : scr;
  const indices = onChoices ? at.all.flatMap((s) => s.choices) : [];
  const choices = indices.map((i): BoxChoice => {
    const c = show.choices![i]!;
    return { index: c.index, choice: c.choice, label: c.text !== null ? fill(c.text) : t(c.labelKey!) };
  });
  const mk = onChoices ? null : marker(at.all, at.page);
  return {
    kind,
    tag,
    text: textScr?.text ?? "",
    choices,
    marker: mk,
    markerClickable: false,
    screen: at.page,
    count: at.all.length,
    portrait: head.voice === "kuro" ? portraitState(state, events, session, nowMs) : null,
    playerPortrait: head.voice !== "kuro" && kind === "inner" ? playerPortraitSrc(state.names.pronoun, isDreamNight(state.day, session.clock.beat)) : null,
    // opening R2: in the prologue a speaker not in npc.json gets a silhouette (stable per name).
    npcPortrait: head.voice !== "kuro" && kind === "line" && line?.k === "speaker" ? (npcPortrait(line.who ?? "") ?? (head.key === PROLOGUE_KEY ? silhouetteFor(line.who ?? "") || null : null)) : null,
    // The first night's hand has no checklist line: a one-time pointer on its choices.
    pointer: pointerCls(session, "raid", scr.choices.length > 0 && raidShowing(state, session)),
    red: lateRing(state.day),
    face: line && kind === "line" ? lineText(state, head, line).face : null,
  };
}

/** The tag carries only the name; Kuro's face is the portrait now (dialogue correction 2026-11-01). */
function tagOf(tag: BoxTag): SafeHtml | null {
  if (!tag) return null;
  if (tag.kind === "kuro") return html`<span class="who tag k">${t("kuro.name")}</span>`;
  return tag.text ? html`<span class="who tag">${tag.text}</span>` : null;
}

/**
 * Kuro's portrait: the slot the one persistent body moves into (the controller attaches it to the
 * page's only `data-kuro-slot`; the HUD body is away while Kuro is in the box), so it has the same
 * frames and crossfade as the HUD body.
 */
const portraitOf = (state: BodyState, red: boolean): SafeHtml =>
  html`<span class="kpet kuro-portrait" data-kuro-slot data-state="${state}"${red ? html` data-red="1"` : null} aria-hidden="true"></span>`;

/** The player's portrait: a still image in Kuro's slot; decorative (the line is the content). */
const playerPortraitOf = (src: string): SafeHtml => html`<img class="player-portrait" src="${src}" alt="" aria-hidden="true" draggable="false">`;

const historyChip = (): SafeHtml => html`<button type="button" class="hist" data-action="dlg-history" aria-haspopup="dialog" aria-label="${t("dialogue.history")}">↺</button>`;

/**
 * The box itself. `waits`: choices are up (in the column, world-prompts R2), so the text does not
 * read on; it only shows the speaker's last line.
 */
export function renderLineBox(m: LineBoxModel, waits = m.choices.length > 0): SafeHtml {
  // The whole text area reads on (a click completes a line still appearing first, polish FR3); not while choices are up.
  const body = m.face ? inFace(m.face, m.text) : m.text;
  const txt = waits ? (m.text ? html`<div class="txt">${body}</div>` : null) : html`<button type="button" class="txt" data-action="loop-advance">${body}</button>`;
  const glyph = m.marker === "more" ? "▼" : "▶";
  const mk = !m.marker || waits
    ? null
    : m.markerClickable
      ? html`<button type="button" class="more" data-action="loop-advance">${glyph}</button>`
      : html`<span class="more" aria-hidden="true">${glyph}</span>`;
  // A tag on the top edge pushes the text down below it (`tagged`).
  const tag = tagOf(m.tag);
  const me = !m.portrait && m.playerPortrait !== null;
  const hasNpc = !m.portrait && !me && m.npcPortrait !== null;
  const c = cls("dlg", m.kind !== "line" && m.kind, tag && "tagged", m.tag?.kind === "kuro" && "kuro", me && "me", hasNpc && "npc", waits && "has-choices");
  // One portrait at most: Kuro's for its lines, NPC's for a speaker line, player's for an inner line.
  const portrait = m.portrait
    ? portraitOf(m.portrait, m.red)
    : hasNpc
      ? html`<img class="npc-portrait" src="${m.npcPortrait!}" alt="" aria-hidden="true" draggable="false">`
      : me
        ? playerPortraitOf(m.playerPortrait!)
        : null;
  // The tag strip on the top edge: the name tag, then ↺ right after it (alone when there is no tag).
  return html`<div class="${c}" data-screen="${m.screen + 1}/${m.count}"><div class="tagbar">${tag}${historyChip()}</div>${txt}${mk}${portrait}</div>`;
}

// ——— the choices column (world-prompts R2) ———————————————————————————————————————————————

/** A row's icon: ◇ a plain choice, a speech bubble Kuro's starters, a pencil 说点别的…. */
export type RowIcon = "plain" | "ask" | "more";
export interface ChoiceRow {
  readonly action: string;
  /** Its data attributes (without `data-`). */
  readonly data: Readonly<Record<string, string>>;
  readonly label: string;
  readonly icon: RowIcon;
  /** 说点别的… chosen: the row is the text field, in place (its draft). */
  readonly field?: { readonly draft: string };
}

const ICON: Readonly<Record<RowIcon, SafeHtml>> = {
  plain: html`<i class="dc-ic plain" aria-hidden="true">◇</i>`,
  ask: html`<i class="dc-ic ask" aria-hidden="true"><svg viewBox="0 0 14 14" width="14" height="14"><path d="M2 2.5h10a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H6.2L3.4 12.3V10H2a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></i>`,
  more: html`<i class="dc-ic more" aria-hidden="true"><svg viewBox="0 0 14 14" width="14" height="14"><path d="M9.6 1.9l2.5 2.5-7.4 7.4-3.1.6.6-3.1z M8.4 3.1l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></i>`,
};

/** The content's choices as rows (◇ each), in content order. */
export function lineRows(m: LineBoxModel): ChoiceRow[] {
  return m.choices.map((c) => ({ action: "loop-choice", data: { index: String(c.index), ...(c.choice ? { choice: c.choice } : {}) }, label: c.label, icon: "plain" }));
}

/** The player's options in a talk with Kuro as rows: the starters (speech bubble), 说点别的… (pencil; the field once chosen), 好。 (◇). */
export function playerRows(p: PlayerBoxModel): ChoiceRow[] {
  return p.options.map((o): ChoiceRow => {
    if (o.action === "kuro-more") return { action: o.action, data: {}, label: o.label, icon: "more", ...(p.mode === "input" ? { field: { draft: p.draft } } : {}) };
    return { action: o.action, data: o.q !== undefined ? { q: String(o.q) } : {}, label: o.label, icon: o.action === "kuro-q" ? "ask" : "plain" };
  });
}

/**
 * The column on the right of the stage (world-prompts R2): the rows stacked upward from just above
 * the box, the first option on top. Each row is a button (↑ ↓ move between them, Enter / Space or
 * 1–9 choose: the controller's keys); 说点别的…'s row is the text field once chosen.
 */
export function renderChoiceColumn(rows: readonly ChoiceRow[], pointer: string | false = false): SafeHtml | null {
  if (!rows.length) return null;
  const items = rows.map((r, i) => {
    if (r.field) {
      return html`<div class="dc-row dc-field">${ICON[r.icon]}<input class="kuro-in" type="text" data-input="kuro-text" data-focus="kuro-text" data-enter="kuro-send" maxlength="500" value="${r.field.draft}" aria-label="${r.label}" placeholder="${r.label}" autocomplete="off" spellcheck="false"></div>`;
    }
    const attrs = Object.entries(r.data).map(([k, v]) => html` data-${k}="${v}"`);
    return html`<button type="button" class="dc-row" data-action="${r.action}"${attrs} data-focus="dc-${i}" data-n="${i + 1}">${ICON[r.icon]}<span class="dc-l">${r.label}</span></button>`;
  });
  return html`<div class="${cls("dlg-choices", pointer)}" role="group">${items}</div>`;
}

/**
 * playtest-1105 R2: a click anywhere reads on — when only a line is up (no choices on it, no
 * player's box, no history panel). Otherwise the screen still waits for the box's own controls.
 */
export function boxReadsOn(state: State, events: readonly GameEvent[], session: Session): boolean {
  if (session.historyOpen || playerBox(state, events, session) !== null) return false;
  const line = lineBoxModel(state, events, session);
  return line !== null && line.choices.length === 0;
}

/** Everything the box shows now: the line box, the player's box, the history panel. */
export function dialogueBox(state: State, events: readonly GameEvent[], session: Session, nowMs = 0): SafeHtml | null {
  const line = lineBoxModel(state, events, session, nowMs);
  const player = playerBox(state, events, session);
  const hist = session.historyOpen ? renderHistory(historyEntries(session, state)) : null;
  if (!line && !player && !hist) return null;
  // world-prompts R2: the box keeps the speaker's last line, name and portrait; the choices (the
  // content's, or the player's on their turn with Kuro) are the column on the right.
  const rows = player ? playerRows(player) : line ? lineRows(line) : [];
  const box = line ? renderLineBox(line, rows.length > 0) : null;
  return html`${box}${renderChoiceColumn(rows, line?.pointer ?? false)}${hist}`;
}
