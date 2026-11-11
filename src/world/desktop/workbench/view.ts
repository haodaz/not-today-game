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
import { openStarters, starterPages } from "@world/dialogue/kuro";
import { greetingKeyAt } from "../beat";
import { frameUrl, FRAMES } from "../kuro/body";
import { taskPageId, type AppContext, type WorkbenchPage } from "../model";
import { closerSlot } from "@world/late/closer-view";
import { RINGS } from "../rings";
import { workbenchDay, workbenchDays, type DocColumn, type WorkbenchDay } from "./data";
import { openWork } from "./work";
import { renderShell } from "./shell";
import { sessionList, type SessionEntry } from "./sessions";
import { COMPOSER_FOCUS } from "./actions";
import { ICONS } from "../icons";

/** U5: the changelog panel collapses to one line from the first day of the second ring. */
export const CHANGELOG_COLLAPSE_DAY: number = (() => {
  for (let day = 1; day <= constants.lastDay; day++) if (ringOf(day) === RINGS[1]) return day;
  return Infinity;
})();

type Fill = (s: string) => string;

/**
 * The session rows (workspace R2): 今天 (the tasks opened today, newest first, the current one
 * highlighted) and 最近 (earlier days', read-only), derived from the log's `open task:<id>`;
 * filtered by the sidebar's search (shell R10). The sidebar and the title's ▾ dropdown share them.
 */
function sessionRows(ctx: AppContext, fill: Fill, filter = ""): { today: SafeHtml | null; recent: SafeHtml | null } {
  const { state, events, session } = ctx;
  const { today, recent } = sessionList(state, events);
  const q = filter.trim().toLowerCase();
  const keep = (e: SessionEntry) => q === "" || fill(e.task.title).toLowerCase().includes(q);
  const current = taskPageId(session.workbenchPage);
  const row = (e: SessionEntry, earlier: boolean) => {
    const on = current === e.taskId && (session.wbTaskDay ?? state.day) === e.day;
    const dot = html`<i class="${cls("dot", e.done ? "done" : "doing")}" aria-label="${tr(e.done ? "wb.task.done" : "wb.task.doing")}"></i>`;
    return html`<button type="button" class="${cls("it", on && "on", earlier && "earlier")}" data-action="wb-nav" data-page="task:${e.taskId}"${earlier ? html` data-day="${e.day}"` : null}>${dot}<span class="tt">${fill(e.task.title)}</span></button>`;
  };
  const t1 = today.filter(keep);
  const r1 = recent.filter(keep);
  return {
    today: t1.length ? html`<div class="sec">${tr("wb.sessions.today")}</div>${t1.map((e) => row(e, false))}` : null,
    recent: r1.length ? html`<div class="sec">${tr("wb.sessions.recent")}</div>${r1.map((e) => row(e, true))}` : null,
  };
}

/** The app's section icons (shell R10): 工作台 · 文档 · 审批 · 通讯录 (审批 and 通讯录 have no page yet). */
const SECTIONS: readonly { key: string; page: WorkbenchPage | null; icon: SafeHtml }[] = [
  { key: "wb.nav.home", page: "home", icon: ICONS.home },
  { key: "wb.nav.docs", page: "docs", icon: ICONS.doc },
  { key: "wb.nav.approvals", page: null, icon: ICONS.approvals },
  { key: "wb.nav.contacts", page: null, icon: ICONS.contacts },
];

/**
 * The sidebar (shell R10): a 280 px panel over the content from the left edge, under the top bar:
 * the section icons, a search box (filters the session titles), + 新任务, 今天 / 最近. Collapsed
 * (the default, everywhere) it is not drawn; ⌘B toggles it; a click outside closes it.
 */
function sidebar(ctx: AppContext, fill: Fill): SafeHtml | null {
  const { session } = ctx;
  if (!session.wbSidebar) return null;
  const page = session.workbenchPage;
  const icons = SECTIONS.map(({ key, page: target, icon }) => {
    // 工作台 is on for its own pages (home, the task pages, 账本, 代码); 文档 for 文档.
    const on = target === page || (target === "home" && (page === "ledger" || page === "code" || taskPageId(page) !== null));
    return target
      ? html`<button type="button" class="${cls("ri", on && "on")}" data-action="wb-nav" data-page="${target}" aria-label="${t(key)}" title="${t(key)}">${icon}</button>`
      : html`<span class="ri" aria-label="${t(key)}" title="${t(key)}">${icon}</span>`;
  });
  const ph = t("msgs.search");
  const search = html`<label class="wb-search">${ICONS.search}<input type="search" data-input="wb-search" data-focus="wb-search" placeholder="${ph}" aria-label="${ph}" value="${session.wbSearch}" autocomplete="off" spellcheck="false"></label>`;
  const fresh = html`<button type="button" class="${cls("it", "new", page === "home" && "on")}" data-action="wb-nav" data-page="home" data-compose="1">${ICONS.plus}<span>${tr("wb.sessions.new")}</span></button>`;
  const rows = sessionRows(ctx, fill, session.wbSearch);
  // author 2026-11-11: the past (content/tasks/past.json) is no longer listed anywhere a click could
  // open it: 最近 holds only the run's own earlier days.
  const recent = rows.recent ?? html`<div class="sec">${tr("wb.sessions.recent")}</div>`;
  return html`<div class="wb-scrim" data-action="wb-sidebar-close" aria-hidden="true"></div><aside class="wb-sidebar sessions"><nav class="wb-sections">${icons}</nav>${search}${fresh}${rows.today}${recent}</aside>`;
}

/** The title's ▾ (shell R10): the session list as a dropdown under the title; a click outside closes it. */
function titleMenu(ctx: AppContext, fill: Fill): SafeHtml | null {
  if (!ctx.session.wbTitleMenu) return null;
  const rows = sessionRows(ctx, fill);
  return html`<div class="wb-scrim" data-action="wb-titlemenu-close" aria-hidden="true"></div><div class="wb-titlemenu sessions" role="menu">${rows.today}${rows.recent}</div>`;
}

/**
 * 工作台's one top bar (shell R10), after the traffic lights: the sidebar toggle, ← →, the page
 * title (a task's with its ▾ session dropdown; on home, 工作台), and at the right end the page's
 * tools (a task page's pane toggles and the 老物件 strip).
 */
function topBar(ctx: AppContext, title: SafeHtml, tools: SafeHtml | null, dropdown: boolean): SafeHtml {
  const { session } = ctx;
  const h = session.wbHistory;
  const label = (key: string) => (hasString(key) ? t(key) : "");
  const toggle = html`<button type="button" class="${cls("sh-tg", "wb-side-tg", session.wbSidebar && "on")}" data-action="wb-sidebar" aria-pressed="${session.wbSidebar ? "true" : "false"}" aria-label="${label("wb.sessions.toggle")}" title="${label("wb.sessions.toggle")}">${ICONS.sidebar}</button>`;
  const back = html`<button type="button" class="sh-tg" data-action="wb-back"${h.at > 0 ? null : html` disabled`} aria-label="←">${ICONS.back}</button>`;
  const fwd = html`<button type="button" class="sh-tg" data-action="wb-forward"${h.at < h.pages.length - 1 ? null : html` disabled`} aria-label="→">${ICONS.forward}</button>`;
  const name = dropdown
    ? html`<button type="button" class="${cls("wb-title", "drop", session.wbTitleMenu && "on")}" data-action="wb-titlemenu" aria-haspopup="menu" aria-expanded="${session.wbTitleMenu ? "true" : "false"}">${title}${ICONS.down}</button>`
    : html`<span class="wb-title">${title}</span>`;
  return html`${toggle}${back}${fwd}${name}<span class="sp"></span>${tools}`;
}

/**
 * Today's open questions (the same pool as the player's box, 2026-11-09: asked ones stay; a follow-up
 * first, tagged), the box's page of five, and 说点别的… for the next page (the box's own counter, so
 * the two stay on the same page).
 */
function starterChips(ctx: AppContext): SafeHtml[] {
  const pages = starterPages(openStarters(ctx.state, ctx.events));
  const page = pages[pages.length ? ctx.session.playerPage % pages.length : 0] ?? [];
  const chips = page.map((s) => html`<button type="button" class="chip q" data-action="wb-compose-q" data-q="${s.n}">${s.after ? t("kuro.followUp") : ""}${getLocale() === "en" && s.en ? s.en : s.zh}</button>`);
  if (pages.length > 1) chips.push(html`<button type="button" class="chip q more" data-action="wb-q-page">${t("dialogue.more")}</button>`);
  return chips;
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
  return html`<div class="ask wb-composer">${box}<div class="strip"><div class="chips">${starterChips(ctx)}${cont}</div>${send}</div></div>`;
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
  // author 2026-11-11: no 已交 rows from before the run on the home card (they read as old abandoned
  // tasks the player could click into); the past stays in content/tasks/past.json for 全部.
  const doing = card(
    tr("wb.card.doing"),
    tr("wb.card.all"),
    html`${openRow}${(data?.doing ?? []).map((j) => html`<div class="ln"><b>${fill(j.title)}</b><span class="${j.tone === "warn" ? "r" : ""}">${fill(j.status)}</span></div>`)}`,
  );
  // guidance R6: a card with nothing in it is not drawn.
  const docs = data?.docs
    ? card(
        tr("wb.card.docs"),
        tr("wb.card.all"),
        html`<div class="big">${fill(data.docs.count)}<small>${fill(data.docs.countLabel)}</small></div>${(data.docs.versions ?? []).map((v) => html`<div class="ln"><b>${fill(v.v)}</b><span>${fill(v.when)}</span></div>`)}`,
      )
    : null;
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
    // guidance R6: the count as a number (0 is 0 次).
    html`${(data?.now ?? []).map((l) => html`<div class="ln"><span>${fill(l.left)}</span><span>${fill(l.right)}</span></div>`)}<div class="ln"><span>${tr("wb.now.letItDo", { n: state.letItDoUnchecked })}</span><span>${state.letItDoUnchecked} ${tr("wb.now.count")}</span></div>`,
    "now",
  );
  const logs = data?.changelog ?? [];
  const log = changelogCollapsed(state.day)
    ? html`<div class="ln"><span style="flex:1;border-top:1px solid var(--ink-2);margin-top:10px"></span></div>`
    : html`${logs.map((c) => html`<div class="ln"><b>${fill(c.v)}</b><span>${fill(c.short)}</span></div>`)}`;
  const changelog = logs.length ? card(tr("wb.card.changelog"), logs[0] && !changelogCollapsed(state.day) ? html`${fill(logs[0].v)}` : null, log) : null;

  const tabs = (data?.common?.tabs ?? []).map((t, i) => html`<span class="${i === 0 ? "on" : ""}">${fill(t)}</span>`);
  const items = (data?.common?.items ?? []).map((i) => html`<div><em>${fill(i.tag)}</em>${fill(i.text)}</div>`);
  const common = items.length ? html`<div class="sect"><h3>${tr("wb.common")}<small>${tr("wb.common.sub")}</small></h3><div class="tabs">${tabs}</div><div class="qa">${items}</div></div>` : null;
  // Home is the greeting, the composer and today's cards: never a board or task content (workspace R1).
  // guidance R6: the greeting follows the clock (12:04 is 下午好).
  return html`<div class="main home"><div class="hello"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><div><h1>${tr(greetingKeyAt(ctx.session.clock.time))}</h1><p>${tr("wb.hello.sub")}</p></div></div>${composer(ctx, data, fill)}<div class="cards">${doing}${docs}${ledger}${now}${changelog}</div>${common}</div>`;
}


/**
 * A task page (workspace R1): a header (title, for whom, 在办 / 已交, the task's own app page, the
 * old objects' strip) and the task's body filling the rest — its board in its view, or its work
 * surface. The task under way is live; a handed-in or an earlier day's task is read back, read-only.
 */
function taskPage(ctx: AppContext, taskId: string, fill: Fill): { main: SafeHtml; title: SafeHtml; tools: SafeHtml } {
  const day = ctx.session.wbTaskDay ?? ctx.state.day;
  const task = taskForId(day, taskId);
  if (!task) return { main: html`<div class="main task"></div>`, title: html``, tools: html`` };
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

export function renderWorkbench(ctx: AppContext, days: ReadonlyMap<number, WorkbenchDay> = workbenchDays): { body: SafeHtml; badge: number; tag: SafeHtml | null; bar: SafeHtml } {
  const data = workbenchDay(ctx.state.day, days);
  const fill: Fill = (s) => fillPlaceholders(s, ctx.state.names);
  const page = ctx.session.workbenchPage;
  const taskId = taskPageId(page);
  const task = taskId !== null ? taskPage(ctx, taskId, fill) : null;
  const main =
    task ? task.main
    : page === "docs" ? docsPage(data, fill)
    : page === "ledger" ? ledgerPage(ctx.state, data, fill)
    : page === "code" ? codePage(ctx.state, data, fill)
    : home(ctx, data, fill);
  // late-days FR4: Kuro at the document's close corner while it comes to shut it.
  const c = ctx.session.kuroCloser;
  const closer = page === "docs" && c?.where === "docs" ? html`<div class="wb-closer">${closerSlot(ctx, c.pageId)}</div>` : null;
  const tag = data?.docs?.tag ? html`${fill(data.docs.tag)}` : null;
  // shell R10: one top bar; the page under it, full height; the sidebar and the title's dropdown
  // over it when open. The work conversations are 听听's (tingtalk 2026-11-04).
  const key = page === "docs" ? "wb.nav.docs" : page === "ledger" ? "wb.nav.ledger" : page === "code" ? "wb.nav.code" : "dock.workbench";
  const title = task ? task.title : html`<span class="tt-name">${tr(key)}</span>`;
  return {
    bar: topBar(ctx, title, task ? task.tools : null, task !== null),
    body: html`<div class="body wb-app">${main}${closer}${sidebar(ctx, fill)}${titleMenu(ctx, fill)}</div>`,
    // Its dock tile counts its own: the jobs under way.
    badge: data?.doing.length ?? 0,
    tag,
  };
}
