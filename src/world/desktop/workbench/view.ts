// 工作台: the system the player wrote for the company; Kuro lives inside it. Home and three inner
// pages (文档 / 账本 / 代码), as in design/desktop/wb-*.html. Copy from strings, day data from
// content/workbench (design U4), live numbers from the store. Work-task actions are inert hooks
// until content/tasks/ exists.
import { TASK_MODES } from "@state/days/effects";
import { constants } from "@state/variables";
import { ringOf } from "@state/stages";
import { loopContext, openTask } from "@world/loop/checklist";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import { greetingKey } from "../beat";
import { frameUrl, FRAMES } from "../kuro/body";
import type { AppContext, WorkbenchPage } from "../model";
import { closerSlot } from "@world/late/closer-view";
import { RINGS } from "../rings";
import { workbenchDay, workbenchDays, type DocColumn, type WorkbenchDay } from "./data";

/** U5: the changelog panel collapses to one line from the first day of the second ring. */
export const CHANGELOG_COLLAPSE_DAY: number = (() => {
  for (let day = 1; day <= constants.lastDay; day++) if (ringOf(day) === RINGS[1]) return day;
  return Infinity;
})();

type Fill = (s: string) => string;

const NAV: readonly { key: string; page: WorkbenchPage | null }[] = [
  { key: "wb.nav.home", page: "home" },
  { key: "wb.nav.new", page: null },
  { key: "wb.nav.docs", page: "docs" },
  { key: "wb.nav.code", page: "code" },
  { key: "wb.nav.ledger", page: "ledger" },
  { key: "wb.nav.tickets", page: null },
  { key: "wb.nav.projects", page: null },
];

function side(data: WorkbenchDay | null, page: WorkbenchPage, fill: Fill): SafeHtml {
  const nav = NAV.map(({ key, page: target }) => {
    const tag = target === "docs" && data?.docs?.tag ? html` <span class="tag">${fill(data.docs.tag)}</span>` : null;
    return target
      ? html`<button type="button" class="${cls("it", page === target && "on")}" data-action="wb-nav" data-page="${target}">${tr(key)}${tag}</button>`
      : html`<div class="it">${tr(key)}</div>`;
  });
  const doing = (data?.doing ?? []).map((j) => html`<div class="job">${fill(j.title)} <em class="${j.tone === "ok" ? "g" : ""}">${fill(j.status)}</em></div>`);
  const recent = (data?.recent ?? []).map((r) => html`<div class="job">${fill(r)}</div>`);
  return html`<div class="side"><div class="logo"><i></i><div><b>${tr("wb.title")}</b><small>${tr("wb.sub")}</small></div></div><div class="search">${tr("wb.search")}</div>${nav}<div class="sec">${tr("wb.sec.doing")}</div>${doing}<div class="sec">${tr("wb.sec.recent")}</div>${recent}<div class="me"><i></i><div><b>${tr("wb.me")}</b><br><small style="color:var(--ink-3)">${tr("wb.me.role")}</small></div></div></div>`;
}

function card(title: SafeHtml, sub: SafeHtml | null, body: SafeHtml, extra = ""): SafeHtml {
  return html`<div class="${cls("card", extra)}"><div class="h"><i></i>${title}${sub ? html`<small>${sub}</small>` : null}</div>${body}</div>`;
}

function changelogCollapsed(day: number): boolean {
  return day >= CHANGELOG_COLLAPSE_DAY;
}

function home(ctx: AppContext, data: WorkbenchDay | null, fill: Fill): SafeHtml {
  const { state } = ctx;
  const doing = card(
    tr("wb.card.doing"),
    tr("wb.card.all"),
    html`${(data?.doing ?? []).map((j) => html`<div class="ln"><b>${fill(j.title)}</b><span class="${j.tone === "warn" ? "r" : ""}">${fill(j.status)}</span></div>`)}`,
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
  const chips = (data?.continue ?? []).map((c) => html`<span>${fill(c)}</span>`);
  const modes = (["wb.mode.self", "wb.mode.look", "wb.mode.let"] as const).map(
    (key, i) => html`<span class="${TASK_MODES[i] === ctx.session.wbMode ? "on" : ""}" data-action="wb-mode" data-mode="${key}">${tr(key)}</span>`,
  );
  // The work task waiting in the checklist (design day-loop L2), as written in content.
  const lc = loopContext(ctx.state, ctx.events);
  const task = lc ? openTask(lc) : null;

  return html`<div class="main"><div class="hello"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><div><h1>${tr(greetingKey(ctx.session.clock.beat))}</h1><p>${tr("wb.hello.sub")}</p></div></div><div class="ask"><div class="ph"${task ? html` data-task="${task.id}" style="color:var(--ink)"` : null}>${task ? fill(task.text) : tr("wb.ask.ph")}</div><div class="modes">${modes}<span style="border:0;color:var(--ink-3)">${tr("wb.scope")}</span><button type="button" class="go" data-action="wb-ask">↑</button></div></div><div class="cards">${doing}${docs}${ledger}${now}${changelog}</div><div class="sect"><h3>${tr("wb.common")}<small>${tr("wb.common.sub")}</small></h3><div class="tabs">${tabs}</div><div class="qa">${items}</div></div><div class="sect"><h3>${tr("wb.continue")}</h3><div class="chips">${chips}</div></div></div>`;
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
  const main =
    page === "docs" ? docsPage(data, fill)
    : page === "ledger" ? ledgerPage(ctx.state, data, fill)
    : page === "code" ? codePage(ctx.state, data, fill)
    : home(ctx, data, fill);
  // late-days FR4: Kuro at the document's close corner while it comes to shut it.
  const c = ctx.session.kuroCloser;
  const closer = page === "docs" && c?.where === "docs" ? html`<div class="wb-closer">${closerSlot(ctx, c.pageId)}</div>` : null;
  return {
    body: html`<div class="body">${side(data, page, fill)}${main}${closer}</div>`,
    badge: data?.doing.length ?? 0,
    tag: data?.docs?.tag ? html`${fill(data.docs.tag)}` : null,
  };
}
