// The boss's call window on 屏幕 (day-loop "the boss calls", correction 2026-11-03: an online meeting
// window on the left screen, light like 工作台, and it takes one minute). Three looks, from the call's
// phase: the ask (「在吗，通个话」 + the one reply 「好的。」), the incoming (ringing) state (the 30-minute
// wait, nothing else possible: the boss's avatar, call.incoming, three dots), and the connected
// meeting: a title bar (call.title · boss name · the timer 00:00 → length), two tiles (the boss, his
// ring pulsing while his line is newest; and you, call.you / call.camOff), a toolbar (mic, camera
// off, share disabled, call.hangup in red disabled until the end), and a captions panel (call.captions;
// a boss line reads 「老板：…」, a `me` line is the player's own summary in grey parentheses). Pure:
// context in, markup out. Every fixed text comes from strings; a missing one renders nothing.
import { cls, html, raw, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { npcAvatar } from "@world/npc";
import { callOf, callPhase, clockText, lengthSeconds, linesShown, type CallPhase } from "@world/loop/call";
import type { AppContext } from "../model";

/** A strings line, or null when content has not written it (so nothing renders). */
const line = (key: string, vars?: Record<string, string | number>): SafeHtml | null => (hasString(key) ? html`${tr(key, vars)}` : null);

const bossAvatar = () => html`<img class="call-av" src="${npcAvatar("boss")}" alt="" aria-hidden="true" draggable="false">`;
const bossName = () => html`<div class="call-name">${tr("msgs.boss")}</div>`;

/** The phase of the call now, from the log, the clock and whether the session says it has connected. */
export function phaseOf(ctx: AppContext): CallPhase {
  const call = callOf(ctx.state.day);
  const connected = ctx.session.call?.day === ctx.state.day && ctx.session.call.connected;
  return callPhase(call, ctx.events, ctx.state.day, ctx.session.clock.time, connected);
}

/** The call overlay, or null when there is no call to show (before it is asked, or after it ends). */
export function renderCall(ctx: AppContext): SafeHtml | null {
  const phase = phaseOf(ctx);
  if (phase === "before" || phase === "ended") return null;
  const call = callOf(ctx.state.day)!;
  if (phase === "ask") {
    const ask = line("call.ask");
    // The reply is the only way to answer, so the button is always there; its label waits for the
    // string (empty until content writes `call.ok`), never the button itself.
    const ok = html`<button type="button" class="call-ok" data-action="call-answer">${hasString("call.ok") ? tr("call.ok") : null}</button>`;
    return html`<div class="call-overlay ask"><div class="call-card">${bossAvatar()}${bossName()}${ask ? html`<div class="call-ask">${ask}</div>` : null}${ok}</div></div>`;
  }
  if (phase === "waiting") {
    // The ringing state: the boss's avatar, call.incoming, three dots; nothing else can be done.
    const incoming = line("call.incoming");
    return html`<div class="call-overlay ringing"><div class="call-win"><div class="call-ring">${bossAvatar()}${bossName()}${incoming ? html`<div class="call-sub">${incoming}</div>` : null}<div class="call-dots" aria-hidden="true"><i></i><i></i><i></i></div></div></div></div>`;
  }
  // Connected: the meeting window (title bar, two tiles, toolbar, captions).
  return connectedPanel(ctx);
}

/** The player's own tile: a plain initial avatar, call.you, call.camOff (the camera is always off). */
function youTile(): SafeHtml {
  const you = hasString("call.you") ? tr("call.you") : null;
  const camOff = line("call.camOff");
  return html`<div class="call-tile you"><div class="call-you-av" aria-hidden="true">${you}</div><div class="call-tile-name">${you}</div>${camOff ? html`<div class="call-camoff">${camOff}</div>` : null}</div>`;
}

/** The boss's tile: his avatar and name, a ring that pulses while his line is the newest. */
function bossTile(speaking: boolean): SafeHtml {
  return html`<div class="${cls("call-tile", "boss", speaking && "speaking")}"><div class="call-ring-wrap">${bossAvatar()}</div><div class="call-tile-name">${tr("msgs.boss")}</div></div>`;
}

/** Line icons for the toolbar (emoji glyphs render unevenly: the crossed camera read as a car). */
const svg = (d: string) => html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${raw(d)}</svg>`;
const ICON = {
  mic: () => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  cam: () => svg('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>'),
  share: () => svg('<path d="M12 15V4M7 9l5-5 5 5M5 15v4h14v-4"/>'),
  hang: () => svg('<path d="M3 14c5-4 13-4 18 0l-2 3-4-1v-2a9 9 0 0 0-6 0v2l-4 1z"/>'),
};

/** A toolbar button: an icon, its label (visible only on 离开; the accessible name otherwise). */
function toolButton(glyph: SafeHtml, labelKey: string, opts: { cross?: boolean; red?: boolean; disabled?: boolean; action?: string } = {}): SafeHtml {
  const has = hasString(labelKey);
  const aria = has ? html` aria-label="${t(labelKey)}"` : null;
  const dis = opts.disabled ? html` disabled` : null;
  const act = opts.action ? html` data-action="${opts.action}"` : null;
  return html`<button type="button" class="${cls("call-tool", opts.cross && "cross", opts.red && "hang")}"${act}${dis}${aria}><span class="call-tool-i" aria-hidden="true">${glyph}</span>${opts.red && has ? html`<span class="call-tool-l">${tr(labelKey)}</span>` : null}</button>`;
}

function connectedPanel(ctx: AppContext): SafeHtml {
  const call = callOf(ctx.state.day)!;
  const total = lengthSeconds(call.length);
  const live = ctx.session.call?.day === ctx.state.day ? ctx.session.call : null;
  // Elapsed as a fraction of the one-minute call (cosmetic; the end is the event). The timer runs
  // 00:00 → length over the minute, so an elapsed call-second is `fraction × length`.
  const fraction = live ? Math.min(1, Math.max(0, (ctx.nowMs - live.answeredMs) / 60_000)) : 1;
  const elapsed = Math.round(fraction * total);
  const shown = linesShown(call, elapsed, total);
  const rows = call.lines.slice(0, shown).map((l, i) => {
    const words = line(`call.l.${ctx.state.day}.${i}`);
    // A boss line reads 「老板：<words>」; a `me` line is the player's own summary in grey parentheses.
    const body = words === null ? null : l.who === "me" ? html`（${words}）` : html`${tr("msgs.boss")}：${words}`;
    return html`<div class="${cls("call-line", l.who)}">${body}</div>`;
  });
  // The boss's ring pulses while his line is the newest.
  const newest = call.lines[shown - 1];
  const bossSpeaking = newest?.who === "boss";
  // Title bar: call.title · the boss's name · the timer running up to the length.
  const title = hasString("call.title") ? html`<span class="call-title">${tr("call.title")}</span>` : null;
  const head = html`<div class="call-topbar">${title}${bossName()}<span class="call-timer">${clockText(elapsed)}</span></div>`;
  const stage = html`<div class="call-stage">${bossTile(bossSpeaking)}${youTile()}</div>`;
  // Toolbar: mic (on), camera (off, crossed), share (disabled), 离开 (red, disabled until the end).
  const hangOff = !!live?.connected;
  const toolbar = html`<div class="call-toolbar">${toolButton(ICON.mic(), "call.mic")}${toolButton(ICON.cam(), "call.camOff", { cross: true })}${toolButton(ICON.share(), "call.share", { disabled: true })}${toolButton(ICON.hang(), "call.hangup", { red: true, disabled: hangOff, action: "call-end" })}</div>`;
  const captionsHead = hasString("call.captions") ? html`<div class="call-cap-head">${tr("call.captions")}</div>` : null;
  const captions = html`<div class="call-captions">${captionsHead}<div class="call-script">${rows}</div></div>`;
  return html`<div class="call-overlay in-call"><div class="call-win">${head}<div class="call-body">${stage}${captions}</div>${toolbar}</div></div>`;
}
