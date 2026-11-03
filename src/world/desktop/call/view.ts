// The boss's call overlay (day-loop "the boss calls", 2026-11-03). Three looks, from the call's
// phase: the ask (「在吗，通个话」 + the one reply 「好的。」), the incoming-call screen (the 30-minute
// wait, nothing else possible), and the connected panel (avatar, name, a timer running to the call's
// length in compressed time with hang-up disabled until it ends, and a transcript filling line by
// line — the boss's words plain, the player's own as a summary in parentheses). Pure: context in,
// markup out. The fixed texts come from strings (call.ask / call.ok / call.incoming / call.hangup);
// a missing one renders nothing. A line's words come from strings too (call.l.<day>.<i>), or nothing.
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, tr } from "@world/i18n";
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
    // The incoming-call screen: nothing else can be done; no hang-up.
    const incoming = line("call.incoming");
    return html`<div class="call-overlay ringing"><div class="call-card">${bossAvatar()}${bossName()}${incoming ? html`<div class="call-sub">${incoming}</div>` : null}<div class="call-dots" aria-hidden="true"><i></i><i></i><i></i></div></div></div>`;
  }
  // Connected: the timer and the transcript.
  return connectedPanel(ctx);
}

function connectedPanel(ctx: AppContext): SafeHtml {
  const call = callOf(ctx.state.day)!;
  const total = lengthSeconds(call.length);
  const live = ctx.session.call?.day === ctx.state.day ? ctx.session.call : null;
  // Elapsed in call seconds, from real ms since the session connected (cosmetic; the end is the event).
  const elapsed = live ? Math.min(total, (ctx.nowMs - live.answeredMs) / 1000) : total;
  const shown = linesShown(call, elapsed, total);
  const rows = call.lines.slice(0, shown).map((l, i) => {
    const words = line(`call.l.${ctx.state.day}.${i}`);
    // The boss's words plain; the player's own as a summary in parentheses.
    const body = words === null ? null : l.who === "me" ? html`（${words}）` : words;
    return html`<div class="${cls("call-line", l.who)}">${body}</div>`;
  });
  // Hang-up is disabled until the call ends (the timer runs it); the button is always present, its
  // label waits for the `call.hangup` string.
  const hangOff = !!live?.connected;
  const hang = html`<button type="button" class="call-hang" data-action="call-end"${hangOff ? html` disabled` : null}>${hasString("call.hangup") ? tr("call.hangup") : null}</button>`;
  return html`<div class="call-overlay in-call"><div class="call-card"><div class="call-head">${bossAvatar()}${bossName()}<div class="call-timer">${clockText(total)}</div></div><div class="call-script">${rows}</div>${hang}</div></div>`;
}
