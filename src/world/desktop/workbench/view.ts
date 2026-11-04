// 工作台: the system the player wrote for the company; Kuro lives inside it. Home and three inner
// pages (文档 / 账本 / 代码), as in design/desktop/wb-*.html. Copy from strings, day data from
// content/workbench (design U4), live numbers from the store. Work-task actions are inert hooks
// until content/tasks/ exists.
import { constants } from "@state/variables";
import { ringOf } from "@state/stages";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { getLocale, hasString, t, tr } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import { taskForId } from "@state/days/board";
import { askedToday, bucketNow } from "@world/dialogue/kuro";
import { bucketAllows } from "@kuro/variable.ts";
import { greetingKey } from "../beat";
import { frameUrl, FRAMES } from "../kuro/body";
import { kuroDay } from "../kuro/days";
import { taskPageId, type AppContext, type WorkbenchPage } from "../model";
import { closerSlot } from "@world/late/closer-view";
import { RINGS } from "../rings";
import { workbenchDay, workbenchDays, type DocColumn, type WorkbenchDay } from "./data";
import { openWork } from "./work";
import { renderShell } from "./shell";
import { renderWorkMessages } from "../messages/view";
import { sessionList, type SessionEntry } from "./sessions";
import { COMPOSER_FOCUS } from "./actions";

/** U5: the changelog panel collapses to one line from the first day of the second ring. */
export const CHANGELOG_COLLAPSE_DAY: number = (() => {
  for (let day = 1; day <= constants.lastDay; day++) if (ringOf(day) === RINGS[1]) return day;
  return Infinity;
})();

type Fill = (s: string) => string;

/**
 * The session list (workspace R2), in place of the old expanded nav column: 新任务 (home, the caret
 * in the composer), 今天 (the tasks opened today, newest first, the current one highlighted) and
 * 最近 (earlier days', read-only). Derived from the log's `open task:<id>`.
 */
function sessions(ctx: AppContext, fill: Fill): SafeHtml {
  const { state, events, session } = ctx;
  const { today, recent } = sessionList(state, events);
  const current = taskPageId(session.workbenchPage);
  const row = (e: SessionEntry, earlier: boolean) => {
    const on = current === e.taskId && (session.wbTaskDay ?? state.day) === e.day;
    const dot = html`<i class="${cls("dot", e.done ? "done" : "doing")}" aria-label="${tr(e.done ? "wb.task.done" : "wb.task.doing")}"></i>`;
    return html`<button type="button" class="${cls("it", on && "on", earlier && "earlier")}" data-action="wb-nav" data-page="task:${e.taskId}"${earlier ? html` data-day="${e.day}"` : null}>${dot}<span class="tt">${fill(e.task.title)}</span></button>`;
  };
  const fresh = html`<button type="button" class="${cls("it", "new", session.workbenchPage === "home" && "on")}" data-action="wb-nav" data-page="home" data-compose="1">${tr("wb.sessions.new")}</button>`;
  const todayList = today.length ? html`<div class="sec">${tr("wb.sessions.today")}</div>${today.map((e) => row(e, false))}` : null;
  const recentList = recent.length ? html`<div class="sec">${tr("wb.sessions.recent")}</div>${recent.map((e) => row(e, true))}` : null;
  // The workbench's own brand (未来智能 · 工作台) lives inside its window only (desktop-ui 2026-11-02,
  // point 1): the OS name is the top bar's; the company brand sits here in the side logo.
  return html`<div class="side sessions"><div class="logo"><i></i><div><b>${tr("wb.brand")}</b><small>${tr("wb.sub")}</small></div></div>${fresh}${todayList}${recentList}<div class="me"><i></i><div><b>${tr("wb.me")}</b><br><small style="color:var(--ink-3)">${tr("wb.me.role")}</small></div></div></div>`;
}

/** Today's starters the player can still ask (as the player's box offers them). */
function starterChips(state: State, events: AppContext["events"]): SafeHtml[] {
  const asked = askedToday(events, state.day);
  const bucket = bucketNow(state);
  const starters = (kuroDay(state.day)?.starters ?? []).filter((s) => !asked.has(s.n) && bucketAllows(s.minBucket, bucket));
  return starters.map((s) => html`<button type="button" class="chip q" data-action="wb-compose-q" data-q="${s.n}">${getLocale() === "en" && s.en ? s.en : s.zh}</button>`);
}

/**
 * The composer (workspace R1): a multi-line box that talks to Kuro (wb-compose-send, ⌘/Ctrl+Enter),
 * today's starters and the continue chips under it. It shares the player's box draft.
 */
function composer(ctx: AppContext, data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const ph = t("wb.composer.placeholder");
  const box = html`<textarea class="wb-compose-in" rows="3" data-input="kuro-text" data-focus="${COMPOSER_FOCUS}" data-enter="wb-compose-send" placeholder="${ph}" aria-label="${ph}" maxlength="500" spellcheck="false">${ctx.session.kuroDraft}</textarea>`;
  const send = html`<button type="button" class="go" data-action="wb-compose-send">↑</button>`;
  const cont = (data?.continue ?? []).map((c) => html`<span class="chip c">${fill(c)}</span>`);
  return html`<div class="ask wb-composer">${box}<div class="strip"><div class="chips">${starterChips(ctx.state, ctx.events)}${cont}</div>${send}</div></div>`;
}

function card(title: SafeHtml, sub: SafeHtml | null, body: SafeHtml, extra = ""): SafeHtml {
  return html`<div class="${cls("card", extra)}"><div class="h"><i></i>${title}${sub ? html`<small>${sub}</small>` : null}</div>${body}</div>`;
}

function changelogCollapsed(day: number): boolean {
  return day >= CHANGELOG_COLLAPSE_DAY;
}

function home(ctx: AppContext, data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const { state } = ctx;
  // 在办: the task under way opens its task page (workspace R1); then the day's own lines.
  const open = openWork(state, ctx.events);
  const openRow = open?.tree
    ? html`<button type="button" class="ln task" data-action="wb-nav" data-page="task:${open.tree.id}"><b>${fill(open.tree.title)}</b><span>${tr("wb.task.doing")}</span></button>`
    : null;
  const doing = card(
    tr("wb.card.doing"),
    tr("wb.card.all"),
    html`${openRow}${(data?.doing ?? []).map((j) => html`<div class="ln"><b>${fill(j.title)}</b><span class="${j.tone === "warn" ? "r" : ""}">${fill(j.status)}</span></div>`)}`,
  );
  const docs = card(
    tr("wb.card.docs"),
    tr("wb.card.all"),
    html`${data?.docs ? html`<div class="big">${fill(data.docs.count)}<small>${fill(data.docs.countLabel)}</small></div>` : null}${(data?.docs?.versions ?? []).map((v) => html`<div class="ln"><b>${fill(v.v)}</b><span>${fill(v.when)}</span></div>`)}`,
  );
  // The overdue days are the store's (30 + day), not content's.
  const ledger = card(
    tr("wb.card.ledger"),
    tr("wb.card.open"),
    html`<div class="big">${state.overdueDays}<small>${data?.ledger ? fill(data.ledger.cardLabel) : null}</small></div>${(data?.ledger?.cardLines ?? []).map((l) => html`<div class="ln"><b>${fill(l.label)}</b><span class="${l.tone === "red" ? "r" : ""}">${fill(l.value)}</span></div>`)}`,
  );
  // 此刻: only what the game really has. Live counts from the store, lines from the day data.
  const now = card(
    tr("wb.card.now"),
    tr("wb.card.now.sub"),
    html`${(data?.now ?? []).map((l) => html`<div class="ln"><span>${fill(l.left)}</span><span>${fill(l.right)}</span></div>`)}<div class="ln"><span>${tr("wb.now.letItDo", { n: state.letItDoUnchecked })}</span><span>${tr("wb.now.count")}</span></div>`,
    "now",
  );
  const log = changelogCollapsed(state.day)
    ? html`<div class="ln"><span style="flex:1;border-top:1px solid var(--ink-2);margin-top:10px"></span></div>`
    : html`${(data?.changelog ?? []).map((c) => html`<div class="ln"><b>${fill(c.v)}</b><span>${fill(c.short)}</span></div>`)}`;
  const changelog = card(tr("wb.card.changelog"), data?.changelog[0] && !changelogCollapsed(state.day) ? html`${fill(data.changelog[0].v)}` : null, log);

  const tabs = (data?.common?.tabs ?? []).map((t, i) => html`<span class="${i === 0 ? "on" : ""}">${fill(t)}</span>`);
  const items = (data?.common?.items ?? []).map((i) => html`<div><em>${fill(i.tag)}</em>${fill(i.text)}</div>`);
  // Home is the greeting, the composer and today's cards: never a board or task content (workspace R1).
  return html`<div class="main home"><div class="hello"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><div><h1>${tr(greetingKey(ctx.session.clock.beat))}</h1><p>${tr("wb.hello.sub")}</p></div></div>${composer(ctx, data, fill)}<div class="cards">${doing}${docs}${ledger}${now}${changelog}</div><div class="sect"><h3>${tr("wb.common")}<small>${tr("wb.common.sub")}</small></h3><div class="tabs">${tabs}</div><div class="qa">${items}</div></div></div>`;
}

/**
 * A task page (workspace R1): a header (title, for whom, 在办 / 已交, the task's own app page, the
 * old objects' strip) and the task's body filling the rest — its board in its view, or its work
 * surface. The task under way is live; a handed-in or an earlier day's task is read back, read-only.
 */
function taskPage(ctx: AppContext, taskId: string, fill: Fill): SafeHtml {
  const day = ctx.session.wbTaskDay ?? ctx.state.day;
  const task = taskForId(day, taskId);
  if (!task) return html`<div class="main task"></div>`;
  // shell (2026-11-04): every task page is the shell — the conversation frame with its cards.
  return renderShell(ctx, task, day, fill);
}

function header(title: SafeHtml | string | null, meta: SafeHtml | string | null, buttons: readonly [string, "" | "eye" | "do", string][]): SafeHtml {
  return html`<div class="ph2"><b>${title}</b><small>${meta}</small><span class="sp"></span>${buttons.map(([key, kind, action]) => html`<span class="${cls("btn", kind)}" data-action="${action}">${tr(key)}</span>`)}</div>`;
}

function docColumn(col: DocColumn, fill: Fill, counts: boolean): SafeHtml {
  const adds = col.lines.filter((l) => l.mark === "add").length;
  const dels = col.lines.filter((l) => l.mark === "del").length;
  const badge = counts && (adds || dels)
    ? html` <span class="add" style="padding:0 6px;border-radius:4px">+${adds}</span> <span class="del" style="padding:0 6px;border-radius:4px;text-decoration:none">−${dels}</span>`
    : null;
  return html`<div class="col"><h4>${fill(col.h)}${badge}</h4>${col.lines.map((l) => html`<div class="${cls("cl", l.mark)}"><b>${l.n}</b>${fill(l.text)}</div>`)}</div>`;
}

function docsPage(data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const page = data?.docs?.page ?? null;
  return html`<div class="page">${header(page ? fill(page.title) : tr("wb.nav.docs"), page ? fill(page.meta) : null, [["wb.docs.side", "", "wb-side"], ["wb.docs.look", "eye", "wb-look"], ["wb.docs.merge", "do", "wb-merge"]])}<div class="cols">${page ? html`${docColumn(page.left, fill, false)}${docColumn(page.right, fill, true)}` : html`<div class="col"><div class="empty"></div></div>`}</div></div>`;
}

function ledgerPage(state: State, data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const l = data?.ledger ?? null;
  const th = (first: string, cols: readonly string[]) =>
    html`<tr><th>${tr(first)}</th>${cols.map((c, i) => html`<th class="${i === 0 ? "" : "n"}">${fill(c)}</th>`)}</tr>`;
  const receivable = (l?.receivable ?? []).map((r) => {
    // "state" means the store's number: yesterday's overdue days → today's.
    const overdue = r.overdue === "state" ? `${state.overdueDays - 1} → ${state.overdueDays}` : fill(r.overdue);
    return html`<tr><td></td><td>${fill(r.client)}</td><td class="n">${fill(r.due)}</td><td class="n">${fill(r.paid)}</td><td class="${cls("n", r.overdue === "state" && "red")}">${overdue}</td></tr>`;
  });
  const salary = (l?.salary ?? []).map(
    (r) => html`<tr class="${r.me ? "me" : ""}"><td></td><td>${fill(r.name)}</td><td class="n">${fill(r.due)}</td><td class="n">${fill(r.paid)}</td><td class="${cls("n", r.me && "red")}">${fill(r.diff)}</td></tr>`,
  );
  const model = (l?.model ?? []).map(
    (r) => html`<tr><td></td><td>${fill(r.date)}</td><td class="n">${fill(r.calls)}</td><td class="n">${fill(r.amount)}</td><td style="color:var(--ink-3)">${tr("wb.ledger.model.note")}</td></tr>`,
  );
  const meta = html`${tr("wb.ledger.receivable")} · ${tr("wb.ledger.salary")} · ${tr("wb.ledger.model")}`;
  return html`<div class="page">${header(tr("wb.nav.ledger"), meta, [["wb.ledger.plus", "", "wb-plus"], ["wb.docs.look", "eye", "wb-look"], ["wb.ledger.update", "do", "wb-update"]])}<div class="cols"><div class="col" style="padding:0"><table class="tbl">${th("wb.ledger.receivable", l?.columns.receivable ?? [])}${receivable}</table><table class="tbl" style="margin-top:18px">${th("wb.ledger.salary", l?.columns.salary ?? [])}${salary}</table><table class="tbl" style="margin-top:18px">${th("wb.ledger.model", l?.columns.model ?? [])}${model}</table></div></div></div>`;
}

function codePage(state: State, data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const code = data?.code ?? null;
  const lines = (code?.lines ?? []).map(
    (l) => html`<span class="g">${l.n}</span>${l.seg.map((s) => (s.k ? html`<span class="${s.k}">${fill(s.s)}</span>` : html`${fill(s.s)}`))}\n`,
  );
  const log = changelogCollapsed(state.day)
    ? html`<div class="v"><p class="line"></p></div>`
    : html`${(data?.changelog ?? []).map((c) => html`<div class="v"><b>${fill(c.v)}</b><small>${fill(c.when)}</small><p>${fill(c.text)}</p></div>`)}`;
  return html`<div class="page">${header(code ? fill(code.file) : tr("wb.nav.code"), code ? fill(code.meta) : null, [["wb.code.test", "", "wb-test"], ["wb.docs.look", "eye", "wb-look"], ["wb.code.pass", "do", "wb-pass"]])}<div class="cols"><div class="col code">${lines}</div><div class="log"><h4>${tr("wb.changelog")}</h4>${log}</div></div></div>`;
}

export function renderWorkbench(ctx: AppContext, days: ReadonlyMap<number, WorkbenchDay> = workbenchDays): { body: SafeHtml; badge: number; tag: SafeHtml | null } {
  const data = workbenchDay(ctx.state.day, days);
  const fill: Fill = (s) => fillPlaceholders(s, ctx.state.names);
  const page = ctx.session.workbenchPage;
  const taskId = taskPageId(page);
  const main =
    taskId !== null ? taskPage(ctx, taskId, fill)
    : page === "docs" ? docsPage(data, fill)
    : page === "ledger" ? ledgerPage(ctx.state, data, fill)
    : page === "code" ? codePage(ctx.state, data, fill)
    : home(ctx, data, fill);
  // late-days FR4: Kuro at the document's close corner while it comes to shut it.
  const c = ctx.session.kuroCloser;
  const closer = page === "docs" && c?.where === "docs" ? html`<div class="wb-closer">${closerSlot(ctx, c.pageId)}</div>` : null;
  // The work conversations live here (desktop-ui 2026-11-02, evening): the rail's 消息.
  const msgs = renderWorkMessages(ctx);
  const tag = data?.docs?.tag ? html`${fill(data.docs.tag)}` : null;
  // workspace R2/R3: the rail and the session list; the old objects only in a task page's header.
  return {
    body:
      page === "msgs"
        ? html`<div class="body">${rail(page, msgs.badge)}<div class="wb-msgs">${msgs.pane}</div></div>`
        : html`<div class="body">${rail(page, msgs.badge)}${sessions(ctx, fill)}${main}${closer}</div>`,
    // Its dock tile counts its own: the jobs under way and the work conversations' unread.
    badge: (data?.doing.length ?? 0) + msgs.badge,
    tag,
  };
}

/** The DingTalk-like left rail: 消息 / 工作台 / 文档 / 审批 / 通讯录. 审批 and 通讯录 have no page yet. */
const RAIL: readonly { key: string; page: WorkbenchPage | null }[] = [
  { key: "wb.nav.msgs", page: "msgs" },
  { key: "wb.nav.home", page: "home" },
  { key: "wb.nav.docs", page: "docs" },
  { key: "wb.nav.approvals", page: null },
  { key: "wb.nav.contacts", page: null },
];

function rail(page: WorkbenchPage, unread: number): SafeHtml {
  const items = RAIL.map(({ key, page: target }) => {
    // 工作台 is on for its own pages (home, the task pages, 账本, 代码); 文档 for 文档; 消息 for the pane.
    const on = target === page || (target === "home" && (page === "ledger" || page === "code" || taskPageId(page) !== null));
    const n = target === "msgs" && unread > 0 ? html`<span class="n">${unread}</span>` : null;
    return target
      ? html`<button type="button" class="${cls("ri", on && "on")}" data-action="wb-nav" data-page="${target}"><i class="${`rg ${key.slice("wb.nav.".length)}`}" aria-hidden="true"></i><span>${tr(key)}</span>${n}</button>`
      : html`<div class="ri"><i class="${`rg ${key.slice("wb.nav.".length)}`}" aria-hidden="true"></i><span>${tr(key)}</span></div>`;
  });
  return html`<nav class="wb-rail">${items}</nav>`;
}
