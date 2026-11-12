// compare (author 2026-11-11): 猜老板的言外之意. The day's work as the author redesigned it after the
// playtest: the workbench stays the real-looking stage (the preview pane renders the page), and the
// decision runs in its own pane — 老王's portrait with three riddles for the page (the key words bold
// and coloured), the two versions of the page side by side as buttons, 克总你定, the row of his faces
// (one per page: pleased / not pleased / not yet), and at the end the settlement: the satisfaction
// and either 发给老王 or 让克总重新改一稿. Pure views; the actions are the board's (board.ts).
import { boardState, canPrint, comparePending, compareRight, compareScore, taskForId, tuneCarried, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, selectedSlot } from "@state/days/ide";
import type { GameEvent } from "@state/events";
import { API_FIELD, SLOT_FIELD, type ComparePage, type Task, type TaskBoard } from "@state/days/tasks";
import type { LaunchMotif } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { npcPortrait, speakerLabel } from "@world/npc";
import { fillPlaceholders } from "@world/replies/placeholders";
import { FRAMES, frameUrl } from "../kuro/body";
import type { Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { cardText, finishLabel, renderBoard } from "./board";
import { openWork } from "./work";
import { browserFrame, settleLayer } from "./settle-layer";
import { battleOffered, battleScene } from "./battle";
import { tunePane } from "./shell";
import { tuneStage } from "./tune-stage";
import { clueStage } from "./clue-stage";
import { meetingStage } from "./meeting-stage";
import { approving, stackStage } from "./stack-stage";
import { tuneOfferPending, tuneOffers } from "@state/days/board";
import { isNight } from "../beat";
import type { AppContext } from "../model";

/**
 * launch (author 2026-11-11/12): the task's opening page over the whole stage, a game's level page,
 * not a card on a web page: paper edge to edge; the counterpart's bust (transparent, watercolour
 * edge) standing on the left at nearly the stage's height, made into a picture by its motif — 老王's
 * business jargon pouring out of his mouth (`words`), Vivi's perfect AI in a thought cloud over her
 * head (`bubble`); a day tag; the task's title, note and call line on the right, 开始工作 under them;
 * Kuro peeking over the stage's bottom-right corner. Up while `session.launchShow` names today's
 * task page (entered through 工作台's row) and the screen is shown.
 */
export function launchLayer(state: State, session: Pick<Session, "launchShow" | "launched" | "view" | "dialogue">): SafeHtml | null {
  if (session.view !== "desktop" || session.launchShow === null) return null;
  const [dayText, taskId] = session.launchShow.split(":");
  const day = Number(dayText);
  if (day !== state.day || !taskId || session.launched.has(session.launchShow)) return null;
  const task = taskForId(day, taskId);
  const l = task?.launch;
  if (!task || !l) return null;
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const who = npcPortrait(l.who);
  // the name tag by the bust: 老王, Vivi, 老周 (launch.name.<id>), else the speaker's label
  const name = hasString(`launch.name.${l.who}`) ? t(`launch.name.${l.who}`) : speakerLabel(l.who, fill);
  const tag = hasString("task.launch.tag") ? html`<div class="tl-tag">${tr("task.launch.tag", { day: String(day) })}</div>` : null;
  const motif = l.motif ? launchMotif(l.motif, fill) : null;
  const wide = l.motif?.kind === "danmaku"; // floats over the whole page, behind everything
  // the picture: the task's own illustration when it has one (no bust, no name tag), else the bust
  const figure = l.art
    ? html`<div class="tl-figure art"><img class="tl-art" src="${l.art}" alt="">${wide ? null : motif}</div>`
    : html`<div class="tl-figure">${who ? html`<img class="tl-who" src="${who}" alt="">` : null}${wide ? null : motif}<span class="tl-name">${name}</span></div>`;
  // the opening (author 2026-11-12): the page's lines play in the dialogue box over the page (queued by
  // `queueLaunchIntro`); the button comes only after it is through
  const talking = session.dialogue.queue.some((q) => q.key.startsWith(`${session.launchShow}:intro`)); // still queued, maybe behind the morning's lines (push numbers keys: …:intro#1)
  const cta = talking ? null : html`<button type="button" class="tl-cta" data-action="task-launch" data-task="${task.id}">${fill(l.cta)}</button>`;
  return html`<div class="${cls("launch-layer", l.motif && `motif-${l.motif.kind}`, `tone-${l.tone ?? "burst"}`, talking && "talking")}" role="dialog" aria-modal="true" aria-labelledby="tl-title">${wide ? motif : null}${tag}${figure}<div class="tl-body"><h2 class="tl-title" id="tl-title">${fill(task.title)}</h2>${l.note.map((n) => html`<p class="tl-note">${fill(n)}</p>`)}<p class="tl-call">${fill(l.call)}</p>${cta}</div><img class="tl-kuro" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true"></div>`;
}

/**
 * The motif that makes the page a picture. `fan`: the items as speech bubbles spread behind the bust
 * like a peacock's tail, each at its own angle and distance (a stable spread from the item's index,
 * never random, so a reload draws the same page). `danmaku`: the items float across the whole page
 * right to left in lanes, like bullet comments. `bubble`: a thought cloud over the head holding the
 * perfect four bars, all full, and the items as chips.
 */
export function launchMotif(m: LaunchMotif, fill: (x: string) => string): SafeHtml {
  if (m.kind === "fan") {
    const n = m.items.length;
    const bubs = m.items.map((w, i) => {
      // the tail: from low left, over the head, to low right, around a centre on the chest; three
      // rings so the bubbles stand clear of the head (the bust is drawn shorter to leave room above)
      const f = n > 1 ? i / (n - 1) : 0.5;
      const angle = 188 + f * 142; // degrees, clockwise from +x; 270 = straight up (ends short of the text column)
      const ring = i % 3; // 0 near, 1 middle, 2 far
      const radius = 40 + ring * 11; // % of the figure box
      const rad = (angle * Math.PI) / 180;
      const x = 50 + radius * 0.8 * Math.cos(rad);
      const y = 66 + radius * Math.sin(rad);
      const size = 14 + ((i * 5) % 3) * 2 + (ring === 0 ? 2 : 0);
      const tilt = Math.round((angle - 270) / 9);
      return html`<span class="${cls("tl-fan-bub", `ring${ring}`)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;font-size:${size}px;--tilt:${tilt}deg;--d:${(i * 70) % 1200}ms">${fill(w)}</span>`;
    });
    return html`<div class="tl-fan" aria-hidden="true">${bubs}</div>`;
  }
  if (m.kind === "danmaku") {
    const lanes = 6;
    const rows = m.items.map((w, i) => {
      const lane = i % lanes;
      const dur = 16 + ((i * 7) % 5) * 3; // seconds across the page
      const delay = -((i * 5.3) % dur); // negative: already on its way at first paint
      const size = 20 + ((i * 3) % 3) * 6;
      return html`<span class="${cls("tl-dm", i % 5 === 2 && "loud")}" style="top:${(6 + lane * 15).toFixed(0)}%;font-size:${size}px;--dur:${dur}s;--delay:${delay.toFixed(1)}s">${fill(w)}</span>`;
    });
    return html`<div class="tl-danmaku" aria-hidden="true">${rows}</div>`;
  }
  const chips = m.items.map((w, i) => html`<span class="tl-chip" style="--d:${(i * 120) % 1200}ms">${fill(w)}</span>`);
  const bars = [0, 1, 2, 3].map((i) => html`<span class="tl-bar" style="--d:${i * 140}ms"><i></i><b>100</b></span>`);
  return html`<div class="tl-bubble" aria-hidden="true"><div class="tl-cloud"><div class="tl-bars">${bars}</div><div class="tl-chips">${chips}</div></div><span class="tl-dot tl-dot1"></span><span class="tl-dot tl-dot2"></span></div>`;
}

/**
 * work (author 2026-11-11/12): the day's work over the whole stage, one screen at a time (「preview
 * 和选择并不放在一起」):
 *   choose  — 老王's three riddles for the page (each a few dozen words, the key words marked), and
 *             the page itself twice: v15's and v16's, each the real deck page rendered with that
 *             version's line, each with 用这版; the row of his faces so far. No 克总你定.
 *   result  — Kuro renders the chosen page (the preview holds for RENDER_MS with 克总在渲染…), then
 *             the page large with 老王's face and a line (笑了 / 撇嘴); 下一页, or 看结算 after the last.
 *   settle  — the satisfaction, the faces, 发给老板 at the bar or 让克总按他的意思重新改一稿 under it.
 * Up while `session.workShow` names today's live board task; gone once the task is done.
 */
export function workLayer(ctx: { readonly state: State; readonly events: readonly GameEvent[]; readonly session: Session; readonly nowMs: number; readonly startDay?: number }): SafeHtml | null {
  const { state, events, session, nowMs } = ctx;
  if (session.view !== "desktop" || session.workShow === null) return null;
  const [dayText, taskId] = session.workShow.split(":");
  if (Number(dayText) !== state.day || !taskId) return null;
  const open = openWork(state, events);
  const task = open?.tree?.id === taskId ? open.tree : undefined;
  const board = task?.board;
  if (!task || !board || state.flags.includes(task.done)) return null;
  // Every other board kind (the tune, the table, the meeting, the old IDE) on the full stage too
  // (author 2026-11-12: 「凡是还挤在真实界面里的游戏操作先搬到全屏层，再逐天细调」): the board's own surface,
  // as the workbench drew it, inside the stage card.
  if (!board.compare) return genericWorkLayer({ state, events, session, nowMs, startDay: ctx.startDay ?? 1 }, task, board);
  const cmp = board.compare;
  const s = boardState(board, state.day, taskId, events);
  const ops = ideOps(task, state.day, events);
  const key = `${state.day}:${taskId}`;
  const holding = !!session.ideHold && session.ideHold.key === key && session.ideHold.until > nowMs;
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const back = hasString("work.back") ? html`<button type="button" class="wl-back" data-action="work-hide">${tr("work.back")}</button>` : null;
  const phase = session.workPhase?.key === key ? session.workPhase : null;
  const pending = comparePending(board, s);
  // battle (author 2026-11-13): 让小鸡上 while a page is still to pick and the chick is held, once per task
  const fight = pending && !session.battle && battleOffered(board, s, state.found as string[], events, state.day, task.id) ? html`<button type="button" class="wl-battle" data-action="battle-start">${tr("battle.go")}</button>` : null;
  const head = html`<header class="wl-head"><span class="wl-title">${fill(task.title)}</span><span class="sp"></span>${fight}${back}</header>`;
  const srcFor = (slot: string, card: string) => ideSrc(board, { ...s, slots: { ...s.slots, [slot]: card } }, ops, slot, tuneCarried(board, events));
  let body: SafeHtml;
  let screen: string;
  if (session.battle?.key === key) {
    screen = "battle";
    body = battleScene(session.battle, nowMs);
  } else if (phase?.phase === "result") {
    // the page just chosen, rendered; 老王's face
    screen = "result";
    const page = cmp.pages.find((p) => p.slot === phase.slot)!;
    const n = cmp.pages.indexOf(page) + 1;
    const card = s.slots[page.slot]!;
    const right = compareRight(board, s.slots, page.slot);
    const face = html`<div class="${cls("wl-face", right ? "happy" : "pout")}"><img src="${right ? BOSS_FACES.happy : BOSS_FACES.pout}" alt=""><p>${resultLine(task, right)}</p></div>`;
    const render = holding
      ? html`<div class="wl-rendering"><img class="wl-rk" src="${frameUrl(FRAMES.busy[0])}" alt=""><p>${tr("compare.rendering.big", { n: String(n) })}</p></div>`
      : html`<div class="wl-page"><iframe class="ide-frame" data-keep="ide-result" src="${srcFor(page.slot, card)}" title="${fill(task.title)}" sandbox="allow-scripts"></iframe></div>`;
    const next = holding ? null : html`<button type="button" class="wl-cta" data-action="compare-next">${tr(pending ? "compare.next" : "compare.sum.open")}</button>`;
    body = html`<div class="wl-result"><div class="wl-result-page">${render}</div><aside class="wl-result-side">${holding ? null : face}${faces(board, s, page, false)}${next}</aside></div>`;
  } else if (pending) {
    // choose: the riddles, the page twice
    screen = "choose";
    const page = pending;
    const n = cmp.pages.indexOf(page) + 1;
    const label = board.slots.find((x) => x.id === page.slot)?.label ?? page.slot;
    const bubbles = page.bubbles.map((b) => html`<div class="cmp-bub">${riddle(b)}</div>`);
    const boss = html`<div class="wl-boss"><img class="cmp-portrait" src="${counterpartPortrait(task)}" alt="${counterpartName(task)}"><div class="cmp-bubbles">${bubbles}</div></div>`;
    // the comparison is the content itself (author 2026-11-12): the page's whole code in each version,
    // side by side as cards, the lines that differ marked, 用这版 at each card's foot.
    const diff = html`<div class="wl-vs" data-slot="${page.slot}">${versionCards(board, page, true, holding)}</div>`;
    body = html`<div class="wl-choose">${boss}<div class="wl-ask"><span class="wl-n">${tr("compare.page", { n: String(n), label })}</span><span class="wl-of">${n} / ${cmp.pages.length}</span><span class="wl-q">${tr("compare.pickTitle")}</span></div>${hasString("compare.diffNote") ? html`<p class="wl-dnote">${t("compare.diffNote")}</p>` : null}${diff}${faces(board, s, page, false)}</div>`;
  } else {
    // settle
    screen = "settle";
    const sc = compareScore(board, s);
    const pass = sc.pct >= cmp.threshold;
    const finish = html`<button type="button" class="wl-cta" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${finishLabel(task)}</button>`;
    // the settlement's two ways out (author 2026-11-13): passed → 发给老板; failed → 让克总帮忙 only (his fill, then it can go)
    const redo = !pass && hasString("settle.kuro") ? html`<button type="button" class="wl-cta ghost" data-action="compare-redo"${holding ? html` disabled` : null}>${tr("settle.kuro")}</button><p class="cmp-note">${tr("settle.kuroNote")}</p>` : null;
    // the settlement (author 2026-11-12): left the game's ending, right the page as it really is now
    const record = html`<div class="cmp-score"><b>${sc.pct}%</b><span>${tr("compare.score", { r: String(sc.right), w: String(sc.total - sc.right) })}</span></div>${faces(board, s, cmp.pages[cmp.pages.length - 1]!, false)}<p class="${cls("cmp-verdict", pass ? "pass" : "fail")}">${tr(pass ? "compare.pass" : "compare.fail", { pct: String(cmp.threshold) })}</p>`;
    const effect = browserFrame(ideSrc(board, s, ops, null, tuneCarried(board, events)), fill(task.title), "ide-settle");
    body = settleLayer({ kind: "page", portrait: counterpartPortrait(task), kick: hasString("sheet.settle.kick") ? t("sheet.settle.kick", { who: counterpartName(task) }) : "", title: fill(task.title), record, effect, actions: html`${pass ? finish : redo}` });
  }
  return html`<div class="work-layer"><section class="work-stage" data-screen="${screen}" role="dialog" aria-modal="true" aria-label="${fill(task.title)}">${head}<div class="wl-body">${body}</div></section></div>`;
}

/** The tune, the table, the meeting and the old IDE board on the full stage: the surface the workbench drew, lifted out of it. */
function genericWorkLayer(c: { state: State; events: readonly GameEvent[]; session: Session; nowMs: number; startDay: number }, task: Task, board: TaskBoard): SafeHtml {
  const { state, events, session, nowMs } = c;
  const app: AppContext = { state, events, startDay: c.startDay, session, night: isNight(session.clock), nowMs };
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const back = hasString("work.back") ? html`<button type="button" class="wl-back" data-action="work-hide">${tr("work.back")}</button>` : null;
  const key = `${state.day}:${task.id}`;
  // battle (author 2026-11-13): 让小鸡上 on the board (not at its settlement), once per task
  const bs = boardState(board, state.day, task.id, events);
  const settling = session.workPhase?.key === key && session.workPhase.phase === "settle";
  const fight = !settling && !session.battle && battleOffered(board, bs, state.found as string[], events, state.day, task.id) ? html`<button type="button" class="wl-battle" data-action="battle-start">${tr("battle.go")}</button>` : null;
  const head = html`<header class="wl-head"><span class="wl-title">${fill(task.title)}</span><span class="sp"></span>${fight}${back}</header>`;
  let body: SafeHtml;
  if (session.battle?.key === key) {
    body = battleScene(session.battle, nowMs);
  } else if (board.tune) {
    // tune stage (author 2026-11-12): the research-node screen, not the config pane and the preview
    body = tuneStage({ state, events, session, nowMs }, task, board);
  } else if (board.view === "meeting" && board.meeting) {
    // meeting stage (2026-11-12): the meeting above, the template under it
    body = meetingStage(app, task, board);
  } else if (board.stack && (() => { const st = boardState(board, state.day, task.id, events); return board.slots.every((x) => x.id in st.slots) && (!st.approved || (session.chain?.key === task.id && approving(session.chain, nowMs))); })()) {
    // stack (2026-11-12): the form filled goes up the chain — 2048 until the top rank appears; then
    // (work-stages-polish 3) the approval moment holds the screen, approved, before the board returns
    const approved = boardState(board, state.day, task.id, events).approved;
    body = stackStage(task, board, session, approved, nowMs);
  } else if (board.kind === "table" && !board.meeting && board.view !== "ide") {
    // clue stage (2026-11-12): the evidence board, not the table pane
    body = clueStage({ state, events, session, nowMs }, task, board);
  } else {
    body = html`<div class="wl-generic">${renderBoard(app, task)}</div>`;
  }
  return html`<div class="work-layer"><section class="work-stage" data-screen="${board.tune ? "tune" : board.view ?? "table"}" role="dialog" aria-modal="true" aria-label="${fill(task.title)}">${head}<div class="wl-body">${body}</div></section></div>`;
}

/**
 * The page's versions as code cards (author 2026-11-12: 「左右 2 个代码版本，按钮坐在卡片的确认的位置，
 * 每个选择里多几个 diff」): each card is the page's whole file in that version — the slot's line
 * holding the card's text, the card's `patch` lines in place of the file's — and every line that is
 * not the same in all versions is marked. Live, 用这版 sits at the card's foot; read, the picked
 * card is marked instead.
 */
export function versionCards(board: TaskBoard, page: ComparePage, live: boolean, busy: boolean): SafeHtml {
  const cmp = board.compare!;
  const file = board.ide?.files?.[page.slot];
  const code = file?.code ?? [];
  const cardOf = (id: string) => [...board.cards, ...board.kuro.cards].find((c) => c.id === id);
  const linesOf = (id: string) => code.map((raw, i) => (cardOf(id)?.patch?.[String(i + 1)] ?? raw).split(API_FIELD).join("./snapshot.js"));
  const all = page.cards.map(linesOf);
  const differs = code.map((_, i) => all.some((ls) => ls[i] !== all[0]![i]) || (code[i] ?? "").includes(SLOT_FIELD));
  const cards = page.cards.map((id, k) => {
    const v = cmp.versions[k] ?? "";
    const rows = all[k]!.map((line, i) => {
      const at = line.indexOf(SLOT_FIELD);
      const body = at < 0 ? html`${line}` : html`${line.slice(0, at)}<b class="wl-field">"${cardText(board, id)}"</b>${line.slice(at + SLOT_FIELD.length)}`;
      return html`<div class="${cls("wl-ln", differs[i] && "chg")}"><span class="wl-gut">${i + 1}</span><span class="wl-mk">${differs[i] ? "~" : ""}</span><code>${body}</code></div>`;
    });
    const foot = live
      ? html`<button type="button" class="wl-use" data-action="compare-pick" data-slot="${page.slot}" data-card="${id}"${busy ? html` disabled` : null}>${tr("compare.use", { v })}</button>`
      : html`<span class="wl-picked"></span>`;
    return html`<div class="${cls("wl-ver", !live && "read")}" data-card="${id}"><div class="wl-vhead"><span class="wl-vname">${v}</span><span class="wl-fname">${file?.name ?? page.slot}</span></div><div class="wl-code">${rows}</div><div class="wl-vfoot">${foot}</div></div>`;
  });
  return html`${cards}`;
}

/** 老王's faces (SVG, drawn in code: author 2026-11-11 「画个卡通的高兴生气就行」) and his portrait. */
export const BOSS_FACES = { happy: "/npc/boss_happy.svg", pout: "/npc/boss_pout.svg" } as const;
export const BOSS_PORTRAIT = "/npc/boss.png";

/** The one whose riddles the page carries: the task's launch counterpart (day 10: 老周), else 老王. */
export const counterpartOf = (task: Task): string => task.launch?.who ?? "boss";
export const counterpartPortrait = (task: Task): string => npcPortrait(counterpartOf(task)) ?? BOSS_PORTRAIT;
export function counterpartName(task: Task): string {
  const who = counterpartOf(task);
  return hasString(`launch.name.${who}`) ? t(`launch.name.${who}`) : t("msgs.boss");
}
/** 老王看了，笑了 / 撇了撇嘴 — per counterpart when a line exists (`compare.result.happy.<who>`), else the default. */
export function resultLine(task: Task, right: boolean): string {
  const who = counterpartOf(task);
  const key = `compare.result.${right ? "happy" : "pout"}`;
  return hasString(`${key}.${who}`) ? t(`${key}.${who}`) : t(key);
}
/** How long Kuro "renders" a page after a pick (the preview holds the old page meanwhile). */
export const RENDER_MS = 900;

/** A riddle's 【key words】 drawn bold and coloured; the rest plain (escaped by the template). */
export function riddle(text: string): SafeHtml {
  const parts = text.split(/【([^】]*)】/);
  return html`${parts.map((p, i) => (i % 2 === 1 ? html`<b class="cmp-key">${p}</b>` : html`${p}`))}`;
}

/** The page the pane shows: the first not picked; else the page of `slot` (a face clicked); else the last. */
export function pageShown(board: TaskBoard, s: BoardState, slot: string | null): ComparePage {
  const cmp = board.compare!;
  return comparePending(board, s) ?? cmp.pages.find((p) => p.slot === slot) ?? cmp.pages[cmp.pages.length - 1]!;
}

/** One face per page: pleased / not pleased / not yet; the shown page marked. */
function faces(board: TaskBoard, s: BoardState, shown: ComparePage, live: boolean): SafeHtml {
  const cmp = board.compare!;
  const row = cmp.pages.map((p, i) => {
    const picked = p.slot in s.slots;
    const mood = !picked ? "todo" : compareRight(board, s.slots, p.slot) ? "happy" : "pout";
    const label = `${t("compare.page", { n: String(i + 1), label: board.slots.find((x) => x.id === p.slot)?.label ?? p.slot })} · ${t(`compare.face.${mood}`)}`;
    const img = mood === "todo" ? null : html`<img src="${BOSS_FACES[mood]}" alt="">`;
    const inner = html`<span class="${cls("cmp-face", mood, p.slot === shown.slot && "cur")}" title="${label}">${img}</span>`;
    return live && picked ? html`<button type="button" class="cmp-face-btn" data-action="shell-slot" data-slot="${p.slot}" aria-label="${label}">${inner}</button>` : html`<span class="cmp-face-btn" aria-label="${label}">${inner}</span>`;
  });
  return html`<div class="cmp-faces" role="list">${row}</div>`;
}

/** The settlement once every page is picked: the score, then the way on (hand in, or Kuro's rewrite). */
function settlement(board: TaskBoard, s: BoardState, live: boolean, busy: boolean): SafeHtml {
  const cmp = board.compare!;
  const sc = compareScore(board, s);
  const pass = sc.pct >= cmp.threshold;
  const score = html`<div class="cmp-score"><b>${sc.pct}%</b><span>${tr("compare.score", { r: String(sc.right), w: String(sc.total - sc.right) })}</span></div>`;
  const verdict = html`<p class="${cls("cmp-verdict", pass ? "pass" : "fail")}">${tr(pass ? "compare.pass" : "compare.fail", { pct: String(cmp.threshold) })}</p>`;
  const redo = !pass && live && hasString("compare.redo")
    ? html`<button type="button" class="sh-chip primary cmp-redo" data-action="compare-redo"${busy ? html` disabled` : null}>${tr("compare.redo")}</button><p class="cmp-note">${tr("compare.redoNote")}</p>`
    : null;
  return html`<div class="cmp-sum">${score}${verdict}${redo}</div>`;
}

/**
 * The 老王的话 pane: his portrait and the page's riddles, the page's two versions (buttons), 克总你定,
 * the faces, and — every page picked — the settlement. While Kuro renders (the preview holds) the
 * buttons wait and the pane says so. Read back (not live): the picks as they were, nothing to press.
 */
export function comparePane(task: Task, board: TaskBoard, s: BoardState, live: boolean, busy: boolean, slot: string | null): SafeHtml {
  const cmp = board.compare!;
  const page = pageShown(board, s, slot);
  const n = cmp.pages.indexOf(page) + 1;
  const label = board.slots.find((x) => x.id === page.slot)?.label ?? page.slot;
  const done = comparePending(board, s) === null;
  const bubbles = page.bubbles.map((b) => html`<div class="cmp-bub">${riddle(b)}</div>`);
  const boss = html`<div class="cmp-boss"><img class="cmp-portrait" src="${counterpartPortrait(task)}" alt="${counterpartName(task)}"><div class="cmp-bubbles">${bubbles}</div></div>`;
  const chosen = s.slots[page.slot];
  const kuro = live && hasString("compare.kuro") ? html`<button type="button" class="sh-chip cmp-kuro" data-action="compare-kuro" data-slot="${page.slot}"${busy ? html` disabled` : null}>${tr("compare.kuro")}</button>` : null;
  const rendering = busy ? html`<div class="cmp-rendering" aria-live="polite">${tr("compare.rendering", { n: String(n) })}</div>` : null;
  const head = html`<div class="cmp-head"><span class="cmp-n">${tr("compare.page", { n: String(n), label })}</span><span class="cmp-of">${n} / ${cmp.pages.length}</span></div>`;
  // The guide rings the pair (never one side: that would name the answer).
  const vs = html`<div class="cmp-vs" data-slot="${page.slot}">${versionCards(board, page, live, busy)}</div>`;
  return html`<div class="${cls("cmp", done && "done", busy && "busy")}" data-task="${task.id}">${boss}${head}${vs}<div class="cmp-tools">${kuro}${rendering}</div>${faces(board, s, page, live)}${done ? settlement(board, s, live, busy) : null}</div>`;
}
