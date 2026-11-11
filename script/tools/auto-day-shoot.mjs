// Walk one whole day headlessly from its content file: node auto-day.mjs <day> [lang] [shotdir]
// Reads content/days/day-NN.json, performs each checklist item in order by its `done` rule,
// presses the dialogue through, and reports which items completed. Dev server on :5173, ?fast=1.
import { spawn } from "node:child_process";
import fs from "node:fs";
const [dayArg, lang = "zh", shotdir = "."] = process.argv.slice(2);
let day = Number(dayArg);
const LAST = Number(process.env.UNTIL || dayArg); // UNTIL=6: keep playing day after day in the same page (real flags carry over)
const ROOT = process.env.PLAY_ROOT || "/Users/aisandbox/Documents/holloween/not-today-game";
let file = JSON.parse(fs.readFileSync(`${ROOT}/content/days/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`, "utf8"));
const objects = JSON.parse(fs.readFileSync(`${ROOT}/content/objects.json`, "utf8")).objects;
let boxObject = Object.entries(objects).find(([, o]) => o.day === day)?.[1] ?? null;
const strings = JSON.parse(fs.readFileSync(`${ROOT}/content/strings/${lang}.json`, "utf8"));
const S = (k) => strings[k] ?? k;
// The day's boards (work v2) and where each card comes from (day graph): the driver opens the source first.
let NN = String(day).padStart(2, "0");
let taskFile = (() => { try { return JSON.parse(fs.readFileSync(`${ROOT}/content/tasks/${lang === "en" ? "en/" : ""}day-${NN}.json`, "utf8")); } catch { return { tasks: [] }; } })();
const boardOf = (id) => taskFile.tasks.find((x) => x.id === id)?.board ?? null;
const loadDay = () => {
  NN = String(day).padStart(2, "0");
  file = JSON.parse(fs.readFileSync(`${ROOT}/content/days/${lang === "en" ? "en/" : ""}day-${NN}.json`, "utf8"));
  boxObject = Object.entries(objects).find(([, o]) => o.day === day)?.[1] ?? null;
  taskFile = (() => { try { return JSON.parse(fs.readFileSync(`${ROOT}/content/tasks/${lang === "en" ? "en/" : ""}day-${NN}.json`, "utf8")); } catch { return { tasks: [] }; } })();
};
const filesJson = JSON.parse(fs.readFileSync(`${ROOT}/content/files.json`, "utf8"));
const folderOf = (fid) => filesJson.folders.find((f) => f.files.some((x) => x.id === fid))?.id ?? null;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.rmSync(`/tmp/nt-auto-${day}`, { recursive: true, force: true }); // a fresh profile: no state from an earlier run of this day
const port = 9334 + day;
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio", "--disk-cache-size=1", "--media-cache-size=1", "--disable-gpu-shader-disk-cache", `--remote-debugging-port=${port}`, "--window-size=1600,900", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/nt-auto-${day}`, "about:blank"], { stdio: "ignore" });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(0.25); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } else if (j.method === "Runtime.exceptionThrown") errors.push((j.params.exceptionDetails.exception?.description || "").split("\n")[0].slice(0, 160)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
const HELPERS = `
window.__vis = (e) => e.getClientRects().length > 0;
window.__txt = (e) => ((e.getAttribute('aria-label')||'')+' '+(e.textContent||'')).replace(/\\s+/g,' ').trim();
window.__click = (sub) => { let els=[...document.querySelectorAll('button,[role=button]')].filter(e=>__vis(e)&&__txt(e).includes(sub)); if(!els.length) return false; els.sort((a,b)=>__txt(a).length-__txt(b).length); els[0].click(); return true; };
window.__sel = (s) => { const el=[...document.querySelectorAll(s)].find(e=>__vis(e)); if(!el) return false; el.click(); return true; };
window.__has = (s) => [...document.querySelectorAll(s)].some(e=>__vis(e));
window.__text = () => (document.body.innerText||'').replace(/\\s+/g,' ');
window.__choices = () => [...document.querySelectorAll('[data-action=loop-choice]')].filter(__vis).map(__txt);
`;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: process.env.HIRES ? 2 : 1, mobile: false });
await send("Page.navigate", { url: `http://localhost:${process.env.PORT || 5173}/?lang=${lang}&day=${day}&splat=0&fast=1&fx=0${process.env.FOUND ? "&found=" + process.env.FOUND : ""}${process.env.SEED ? "&seed=" + process.env.SEED.replace(/\+/g, "%2B") : ""}` }); // SEED=flags:a+b,san:80 lays earlier days' flags over a mid-run start (see main.ts debugSeed) // fx=0: the collapse shader stalls SwiftShader
for (let i = 0; i < 40; i++) { if ((await ev("document.readyState")) === "complete") break; await sleep(0.25); }
// Storage turned out to be shared between headless profiles on this machine: start every day from nothing.
await ev("localStorage.clear(); sessionStorage.clear(); location.reload(); 'cleared'");
await sleep(1); for (let i = 0; i < 40; i++) { if ((await ev("document.readyState")) === "complete") break; await sleep(0.25); }
await sleep(2.5); await ev(HELPERS);
console.log(`storage at start: ${await ev("JSON.stringify(Object.keys(localStorage))")}`);

const log = [];
const note = (s) => { log.push(s); console.log(s); };
const key = async (k) => { const code = k === " " ? "Space" : k; await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code }); await sleep(0.35); };
const click = async (sub, wait = 1.2) => { const ok = await ev(`__click(${JSON.stringify(sub)})`); await sleep(wait); await ev(HELPERS); return ok; };
const sel = async (s, wait = 1.2) => { await unmask(); const ok = await ev(`__sel(${JSON.stringify(s)})`); await sleep(wait); await ev(HELPERS); return ok; };
const unmask = async () => { for (let i = 0; i < 30 && (await has(".dlg-layer .story-mask")); i++) { await ev("document.querySelector('.dlg-layer .story-mask').click()"); await sleep(0.4); } };
const until = async (s, secs = 8) => { for (let i = 0; i < secs * 4; i++) { if (await has(s)) return true; await sleep(0.25); } return false; };
const has = (s) => ev(`__has(${JSON.stringify(s)})`);
const waitFor = async (s, secs, each = null) => { for (let i = 0; i < secs * 2; i++) { if (await has(s)) return true; if (each) await each(); await sleep(0.5); } return has(s); };
const text = async () => { const t = await ev("__text()"); if (typeof t === "string") return t; await ev(HELPERS); const u = await ev("__text()"); return typeof u === "string" ? u : ""; };
// Things that can interrupt any step: the boss call (answer, wait out the unskippable call, hang up)
// and Vivi's lock (open her deliverable from its bubble in the group).
let busy = false;
const interrupts = async () => {
  if (busy) return; busy = true;
  try {
    // dictionary-guide (2026-11-10): the first use's example card is read and closed.
    if (await has("[data-action=dict-guide-ok]")) { await shotStep("dict-guide"); await ev("__sel('[data-action=dict-guide-next]')"); await sleep(0.3); await ev("__sel('[data-action=dict-guide-ok]')"); await sleep(0.4); }
    if (await has("[data-action=call-answer]")) {
      note("   call: answering"); await ev("__sel('[data-action=call-answer]')"); await sleep(1);
      let ended = false, live = false; for (let i = 0; i < 300 && !ended; i++) { if (!live && (await has(".call-overlay.in-call"))) { live = true; await sleep(2.5); await shotStep("call-live"); } if (await has("[data-action=call-end]:not([disabled])")) { await ev("__sel('[data-action=call-end]:not([disabled])')"); ended = true; } else if (live && !(await has(".call-overlay"))) ended = true; else await sleep(1); }
      note(`   call: ${ended ? "over" : "still on after 300 s"}`); await shotStep("call"); await sleep(1.5);
    }
    if ((await text()).includes(S("vivi.lock")) && !(await has("[data-action=open-deliverable]"))) {
      note("   vivi lock: looking for the deliverable");
      await unmask(); if (!(await has("[data-action=wb-nav]"))) await click(S("wb.title"), 2);
      await toTingTalk();
      const n = await ev("[...document.querySelectorAll('[data-action=conv]')].filter(__vis).length");
      for (let i = 0; i < (n || 0) && !(await has("[data-action=open-deliverable]")); i++) { await ev(`[...document.querySelectorAll('[data-action=conv]')].filter(__vis)[${i}].click()`); await sleep(1); }
    }
    // Vivi's deliverable bubbles stay in the thread all day: each doc is opened once a day (the guide's
    // ring is on one of them — the one the task page waits for), not on every look.
    globalThis.__docsOpened ??= {}; const opened = (globalThis.__docsOpened[day] ??= new Set());
    const docs = JSON.parse((await ev("JSON.stringify([...document.querySelectorAll('[data-action=open-deliverable]')].filter(__vis).map(e=>e.dataset.doc||''))")) || "[]").filter((d) => d && !opened.has(d));
    for (const doc of docs) { opened.add(doc); globalThis.__viviOpened = day;
      note(`   vivi: opening the deliverable ${doc}`); await ev(`__sel('[data-action=open-deliverable][data-doc="${doc}"]')`); await sleep(2); await shotStep("deliverable"); await key("Escape"); await sleep(1);
      // guidance R14: the locked page has a tail line (vivi.back) that owns the screen until read.
      for (let n = 0; n < 8 && (await has("[data-action=loop-advance]")); n++) { await ev("__sel('[data-action=loop-advance]')"); await sleep(0.5); }
      // the thread again for the next card (her page opens in 浏览器 on the other monitor)
      if (docs.indexOf(doc) < docs.length - 1) { await ev("__sel('[data-action=dock][data-app=tingtalk]')"); await sleep(1); }
      // her page opens in 浏览器 (Esc does not close a window): back to 工作台 from the dock.
      if (!(await has("[data-action=wb-nav]")) && (await has("[data-action=dock][data-app=workbench]"))) { await ev("__sel('[data-action=dock][data-app=workbench]')"); await sleep(1.2); } }
  } finally { busy = false; }
};
let stepNo = 0;
const shotStep = async (name) => { const r = await send("Page.captureScreenshot", process.env.HIRES ? { format: "png" } : { format: "jpeg", quality: 60 }); fs.writeFileSync(`${shotdir}/d${String(day).padStart(2, "0")}-${String(++stepNo).padStart(2, "0")}-${name}.${process.env.HIRES ? "png" : "jpg"}`, Buffer.from(r.result.data, "base64")); };
// Press the box through; answer a pending choice (the recognise question by its right option, else the first).
const settle = async (rightOption = null) => {
  let quiet = 0;
  for (let i = 0; i < 24 && quiet < 2; i++) {
    await interrupts();
    const choices = await ev("JSON.stringify(__choices())").then(JSON.parse);
    if (choices.length) { await shotStep("choice"); const pick = (rightOption && choices.find((c) => c.includes(rightOption))) || choices.find((c) => c.includes(S("kuro.notNow"))) || choices.find((c) => c.includes(S("room.bed.sleep"))) || choices[0]; note(`   choice → ${pick}`); await click(pick); quiet = 0; continue; }
    if (await has(".dlg-layer .story-mask")) { await ev("document.querySelector('.dlg-layer .story-mask').click()"); await sleep(0.4); quiet = 0; continue; }
    const t = await text();
    if (/[▶▼]/.test(t)) { await key(" "); await sleep(0.25); quiet = 0; } else { await key(" "); quiet++; }
  }
};
const inRoom = async () => (await has("[data-action=view][data-view=desk]")) && (await has("[data-action=bed]")) && !(await has("[data-action=view][data-view=room]"));
const toRoom = async () => { if (await has("[data-action=onboard-skip]")) await sel("[data-action=onboard-skip]", 0.6);
  for (let i = 0; i < 8; i++) {
    if (await inRoom()) return true;
    // box-arrival: the case left open at 窗 blocks the turn: close it first (author 2026-11-11 run)
    if (await has("[data-action=case-close]")) { await sel("[data-action=case-close]", 0.8); continue; }
    await key(" ");
    if (await has("[data-action=view][data-view=room]")) await sel("[data-action=view][data-view=room]", 2.2);
    else { const face = await ev("(document.querySelector('.stage.room')?.className.match(/(\\w+)-view/) || [])[1] || ''");
      if (face === 'bed') { await key("ArrowLeft"); await sleep(1.2); }                       // 四面墙（room-turn）：床在右边，转回来
      else if (face === 'door' || face === 'window') { await key("ArrowRight"); await sleep(1.2); }
      else if (face === 'lying') { await rise(); }                                            // lying-view R6: the morning starts in bed
      else { await key("Escape"); await sleep(1.2); } }
  }
  note("   (could not get back to the room)"); return false;
};
// lying-view R6: read the morning's lines through, Esc asks 要起来吗？, take 起床 (a rise beat may follow: read it on).
const rise = async () => {
  for (let i = 0; i < 12 && (await has("[data-action=loop-advance]")); i++) { await ev("__sel('[data-action=loop-advance]')"); await sleep(0.4); }
  await key("Escape"); await sleep(0.8);
  for (let i = 0; i < 6 && !(await click(S("room.rise.up"), 1.5)); i++) { await key(" "); await sleep(0.4); }
  await settle(); await sleep(0.8);
};
// guidance (air walls): with the delivery at the door the screen refuses — the food is fetched first, then the screen.
const pickupIfDue = async () => {
  if (await has("[data-action=screen]")) return false;
  if (!(await has("[data-action=view][data-view=door]"))) return false;
  // the day's pickup item is listed (unlocked, not done) — the hint pill shows only once a run, so the list is the test
  const picks = file.items.filter((x) => x.done === "event:pickup:lunch" || x.done === "event:pickup:dinner").map((x) => x.text);
  const tx = await text();
  if (!picks.some((t) => tx.includes(t))) return false;
  note("   (the delivery is at the door: fetching it before the screen)");
  await sel("[data-action=view][data-view=door]", 2.5); await settle();
  let steps = 0; while (steps < 6 && (await sel("[data-action=loop-door]", 2))) { steps++; await settle(); }
  await settle(); await toRoom(); return steps > 0;
};
// A line up in the box owns the screen (nothing else answers): read it before any click.
const readLines = async () => { for (let n = 0; n < 10 && (await has("[data-action=loop-advance]")); n++) { await ev("__sel('[data-action=loop-advance]')"); await sleep(0.45); } };
const toDesktop = async () => { for (let n = 0; n < 8 && (await has("[data-action=loop-advance]")); n++) { await ev("__sel('[data-action=loop-advance]')"); await sleep(0.5); } await toRoom(); await sel("[data-action=view][data-view=desktop][data-screen=left]", 2);
  if (!(await has("[data-action=screen]")) && (await pickupIfDue())) await sel("[data-action=view][data-view=desktop][data-screen=left]", 2);
  // author 2026-11-11: a delivery pulled the camera to 门 (the doorbell's tail) and the door asks 拿进来吗？: take it, then the screen
  if (!(await has("[data-action=screen]")) && /door-view/.test((await ev("document.querySelector('.stage')?.className")) || "")) {
    note("   (at the door with a delivery: taking it in before the screen)");
    await settle(); let steps = 0; while (steps < 6 && (await sel("[data-action=loop-door]", 2))) { steps++; await settle(); }
    await settle(); await toRoom(); await sel("[data-action=view][data-view=desktop][data-screen=left]", 2);
  }
  if (!(await has("[data-action=screen]"))) { note(`   (screen not entered: stage=${await ev("document.querySelector('.stage')?.className")} acts=${await ev("JSON.stringify([...new Set([...document.querySelectorAll('[data-action]')].filter(__vis).map(e=>e.dataset.action+':'+(e.dataset.view||'')))])")} · ${(await text()).slice(0, 100)}`); await shotStep("screen-refused"); }
  if (await has("[data-action=onboard-skip]")) { note("   (coach marks: skipped)"); await sel("[data-action=onboard-skip]", 0.6); } };
const toTingTalk = async () => { await toRoom(); await sel("[data-action=view][data-view=desktop][data-screen=right]", 2); if (await has("[data-action=onboard-skip]")) await sel("[data-action=onboard-skip]", 0.6);
  // playtest-1105 R1: nothing is open on a first visit; 汀汀 opens from the dock (the left monitor's).
  if (!(await has("[data-action=conv]"))) { await sel("[data-action=view][data-view=desktop][data-screen=left]", 1.5); if (await has("[data-action=onboard-skip]")) await sel("[data-action=onboard-skip]", 0.6); await sel("[data-action=dock][data-app=tingtalk]", 1.5); }
  await ev(HELPERS);
  // guidance G3 (scope all): a morning with news from the boss refuses everything until his thread is opened — once a day, first.
  if (globalThis.__bossSeen !== day && (await has("[data-action=conv][data-conv=boss]"))) { globalThis.__bossSeen = day; await sel("[data-action=conv][data-conv=boss]", 1); await readLines(); note("   (the boss's thread opened first)"); }
  return await has("[data-action=conv]"); };
const goHome = async () => { if (!(await has("[data-action=wb-nav][data-page=home]"))) await sel("[data-action=wb-sidebar]", 0.6); return sel("[data-action=wb-nav][data-page=home]", 1); };
const wbOpen = async () => (await has("[data-action=wb-nav]")) || (await has("[data-action=wb-sidebar]"));
// The day's box: lift it, take the loose one, read the recognise lines (the right option), back to the room.
const openBox = async () => {
  await toRoom(); await sel("[data-action=pick-box]", 1.2); const ok = await sel("[data-action=case-pick].loose", 2.5); if (!ok) note(`   case: no loose box · ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=case-pick]')].map(e=>e.dataset.slot+':'+e.className))")}`);
  const right = boxObject?.options?.find((o) => o.right)?.t ?? null; await settle(right); await key("Escape"); await settle(right); await toRoom(); return ok;
};
// guidance R1: at a guided moment the one thing to do carries the ring (data-guide="on"); follow it
// (a card → its page, a conversation row → the card, a dock tile → the app) until there is no ring.
const followRing = async (max = 6) => {
  for (let i = 0; i < max; i++) {
    await readLines();
    const tag = await ev("(()=>{const e=[...document.querySelectorAll('[data-guide=\"on\"]')].find(__vis); return e ? (e.dataset.action||e.tagName)+':'+(e.dataset.doc||e.dataset.conv||e.dataset.app||e.dataset.view||'') : null})()");
    if (!tag) return i > 0;
    note(`   (following the ring: ${tag})`);
    await ev("__sel('[data-guide=\"on\"]')"); await sleep(1.5); await readLines();
    if (tag.startsWith("open-deliverable")) { await shotStep("deliverable"); await key("Escape"); await sleep(0.8); await readLines(); return true; }
  }
  return true;
};
const toWorkbench = async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await toDesktop(); await readLines(); if (await has("[data-action=files-close]")) await sel("[data-action=files-close]", 0.6);
    if (!(await wbOpen())) { const dk = await sel("[data-action=dock][data-app=workbench]", 2); if (!dk) await click(S("wb.title"), 2); if (!(await wbOpen())) { const line = await text();
        // G5: Vivi's page first (「Vivi 在群里发了个网页，先点开看一眼。」): the refusal names it; open her card(s), then try again.
        if (line.includes(S("vivi.lock"))) { note("   (Vivi's page first: following the ring to her card)"); await readLines(); if (!(await followRing())) await interrupts(); await readLines(); continue; }
        note(`   (dock workbench ${dk}: still no 工作台 · screen ${await has("[data-action=screen]")} · line: ${line.slice(0, 200)}`); await shotStep("wb-missing"); } await readLines(); }
    // 工作台 can be on the other monitor (a page opened on the right moved the focus): look there, then back.
    for (const side of ["right", "left"]) { if (await wbOpen()) break; await readLines(); await sel(`[data-action=screen][data-screen=${side}]`, 1.2); await readLines(); if (!(await has("[data-action=wb-nav]"))) { await sel("[data-action=dock][data-app=workbench]", 1.5); await readLines(); } }
    if (await wbOpen()) return;
    // The checklist shows only its current line on the screen: step back into the room to read the whole list.
    await readLines(); await toRoom(); const tx = await text();
    // The meal's arrival (the lunch lands at 12:02) pulls the camera to the door, and while 去拿 is listed
    // the guidance refuses the workbench: fetch it from wherever the driver stands, eat at the table
    // (the table holds the camera until then), then try again.
    const picks = file.items.filter((x) => x.done === "event:pickup:lunch" || x.done === "event:pickup:dinner").map((x) => x.text);
    const listed = picks.some((t) => tx.includes(t));
    if ((await has("[data-action=loop-door]")) || listed) {
      note(`   (the meal is waiting (${listed ? "去拿 listed" : "at the door"}): fetching it before the workbench)`);
      await readLines(); await toRoom();
      if (!(await has("[data-action=loop-door]"))) await sel("[data-action=view][data-view=door]", 2.5);
      let steps = 0; while (steps < 6 && (await sel("[data-action=loop-door]", 2))) { steps++; await settle(); }
      await settle();
      if (await has("[data-action=loop-eat]")) { note("   (ate at the table first)"); await sel("[data-action=loop-eat]", 2); if (await has("[data-action=loop-eat]")) await sel("[data-action=loop-eat]", 1.5); await settle(); }
      await toRoom(); if (steps > 0 || listed) continue;
    }
    // The box is the lit target (day 1 after lunch: 拆开看看): open it, then try again.
    const boxItem = file.items.find((x) => x.done === "event:openBox");
    if (boxItem && tx.includes(boxItem.text) && (await has("[data-action=pick-box]"))) { note("   (the box is the lit target: opening it before the workbench)"); await openBox(); continue; }
    break;
  }
  if (!(await wbOpen())) note(`   (工作台 not found: stage=${await ev("document.querySelector('.stage')?.className")} acts=${await ev("JSON.stringify([...new Set([...document.querySelectorAll('[data-action]')].filter(__vis).map(e=>e.dataset.action+':'+(e.dataset.app||e.dataset.screen||'')))])")} line=${(await text()).slice(0, 60)})`);
};
const lastEvents = () => ev(`(()=>{ const t = localStorage.getItem('nt_run') || ''; return (t.match(/"kind":"[a-zA-Z]+"(,"[a-zA-Z]+":"[^"]*")?/g) || []).slice(-4).join(' ').replace(/"kind":/g,''); })()`);
// Open a card's source (day graph): a conversation, a file in 文件, or a Vivi page from its bubble; a call is already over.
let currentTaskId = null;
const gather = async (card) => {
  const from = card.from; if (!from || from.call) return true;
  // A meeting card is heard in the board's own meeting: open the task page, let it play (fast=1: 0.3 s a line).
  if (from.meeting) { await toWorkbench(); await goHome(); await sel(`[data-action=wb-nav][data-page='task:${currentTaskId}']`, 1.2); for (let i = 0; i < 4 && !(await has("[data-action=meeting-play]")); i++) await sleep(0.5); await sel("[data-action=meeting-play]", 0.3); await sleep(9); return true; }
  if (from.conv) { await toTingTalk(); return sel(`[data-action=conv][data-conv=${from.conv}]`, 1.2); }
  const folder = folderOf(from.file);
  if (folder) {
    await toDesktop(); await readLines();
    // the 文件 icon is on the left monitor's desktop
    if (await has("[data-action=screen][data-screen=left]")) await sel("[data-action=screen][data-screen=left]", 0.8);
    await sel("[data-action=decoy][data-decoy=files]", 1.2);
    await readLines(); // a line up (the lunch's 已送达) owns the screen — and reading it can pull the camera to the room
    if (!(await has("[data-action=screen]"))) { note("   files: pulled out of the screen (the delivery?) — back"); await toDesktop(); await readLines(); if (await has("[data-action=screen][data-screen=left]")) await sel("[data-action=screen][data-screen=left]", 0.8); await sel("[data-action=decoy][data-decoy=files]", 1.2); }
    await until("[data-action=file-tab]", 6); // the window takes a moment
    await readLines();
    await shotStep("files");
    await sel(`[data-action=file-tab][data-tab=${folder}]`, 0.8);
    const r = await sel(`[data-action=file-open][data-file=${from.file}]`, 1.2);
    if (!r) note(`   files: ${from.file} not listed · win ${await ev("JSON.stringify([...document.querySelectorAll('.filesw,[data-files]')].map(e=>e.className+':'+__vis(e)))")} · visible ${await ev("JSON.stringify([...document.querySelectorAll('[data-action]')].filter(__vis).map(e=>e.dataset.action+':'+(e.dataset.tab||e.dataset.file||e.dataset.decoy||'')).filter(a=>/file|decoy|loop-advance/.test(a)).slice(0,30))")} · tabs ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=file-tab]')].map(e=>e.dataset.tab+(e.classList.contains('on')?'*':'')))")} files ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=file-open]')].map(e=>e.dataset.file))")} · ${(await text()).slice(0, 80)}`);
    await settle(); await sel("[data-action=files-close]", 0.8); return r;
  }
  await toTingTalk();
  for (const c of ["group", "partner", "boss"]) { await sel(`[data-action=conv][data-conv=${c}]`, 1); if (await sel(`[data-action=open-deliverable][data-doc=${from.file}]`, 1.5)) { await key("Escape"); await settle(); return true; } }
  return false;
};

for (;;) {
await send("Network.clearBrowserCache"); // a day at a time: the cache filled the disk once (2026-11-05)
const results = [];
// The boss's call adds a night task (content days[].call.task); do it before the desk beat.
const ITEMS = [...file.items];
if (file.call?.task) { const i = ITEMS.findIndex((x) => x.id === "desk"); ITEMS.splice(i < 0 ? ITEMS.length : i, 0, file.call.task); }
// An item unlocked by a later item (day 3: the cold dinner after v18) is done after it, not in file order.
for (let pass = 0; pass < ITEMS.length; pass++) {
  const i = ITEMS.findIndex((it, k) => { const m = /^done:(\w+)$/.exec(it.unlock || ""); return m && ITEMS.findIndex((x) => x.id === m[1]) > k; });
  if (i < 0) break;
  const [it] = ITEMS.splice(i, 1); const j = ITEMS.findIndex((x) => x.id === /^done:(\w+)$/.exec(it.unlock)[1]); ITEMS.splice(j + 1, 0, it);
}
for (const it of ITEMS) {
  currentTaskId = it.id;
  const [kind, ...rest] = it.done.split(":"); const what = rest.join(":");
  note(`▶ ${it.id} (${it.done}) ${it.text}`);
  if (await has("[data-action=onboard-skip]")) { note("   (coach marks: skipped)"); await sel("[data-action=onboard-skip]", 0.6); }
  const t0 = await text();
  const before = (() => { const m = /已做 (\d+) 件|(\d+) done/.exec(t0); return m ? Number(m[1] ?? m[2]) : -1; })();
  let ok = true;
  try {
    // A self-ticking item (day 17 「把东西放回去」, `self: true`): the runtime ticks it after a beat; nothing to do.
    if (it.self === true) { note("   (ticks itself: skipped)"); await settle(); }
    else     if (it.done === "event:boot") { await toRoom(); ok = await sel("[data-action=tower-power]"); if (!ok) { await sel("[data-action=view][data-view=desk]", 2); ok = await sel("[data-action=tower-power]"); } await settle(); }
    else if (it.done === "event:openApp:msgs") { ok = await toTingTalk(); await settle(); await toRoom(); }
    else if (it.done === "event:order:lunch" || it.done === "event:order:dinner") {
      const meal = what; await toRoom(); const d1 = await sel("[data-action=view][data-view=desk]", 2); await until("[data-action=loop-phone]", 8); await settle(); ok = await sel("[data-action=loop-phone]", 1.5);
      if (!ok) { note(`   phone: desk=${d1} phoneBtn=${await has("[data-action=loop-phone]")} · buttons=${await ev("JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(__vis).map(__txt).slice(0,20))")} · ${(await text()).slice(0, 160)}`);
        const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 }); fs.writeFileSync(`${shotdir}/auto-day-${day}-phone.jpg`, Buffer.from(shot.result.data, "base64")); }
      // The app: home → a shop → an item → checkout → 下单 (loop-order); old one-step menus still work as a fallback.
      const step = async (name, s) => { const r = await sel(s, 1.2); if (!r) note(`   phone: no ${name} · ${(await text()).slice(0, 160)}`); return r; };
      if (await has("[data-action=phone-shop]")) { ok = ok && await step("shop", "[data-action=phone-shop]:not([disabled])") && await step("item", "[data-action=phone-add]:not([disabled])") && await step("checkout", "[data-action=phone-checkout]"); }
      ok = ok && await step("下单", "[data-action=loop-order]:not([disabled])"); await key("Escape"); await settle(); await toRoom();
    }
    else if (kind === "flag" && what.startsWith("task")) {
      // A board's card sources first (day graph): BOARD=assist only needs the first card; BOARD=trap puts a 坑 in the first slot.
      const board = boardOf(it.id);
      if (board) {
        const want = process.env.BOARD === "assist" ? board.slots.slice(0, 1) : board.slots;
        const cards = want.map((sl) => board.cards.find((c) => c.id === (process.env.BOARD === "trap" && sl === board.slots[0] ? (board.cards.find((c) => c.id.startsWith("d"))?.id ?? sl.answer) : sl.answer))).filter(Boolean);
        if (board.given?.lock?.from) { await toWorkbench(); await goHome(); await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1.2);
          if (await has("[data-action=board-lock]")) { const lbl = await ev("document.querySelector('[data-action=board-lock]').textContent.trim()"); await sel("[data-action=board-lock]", 0.6); note(`   lock before its source: "${lbl}", chips ${await has("[data-action=board-code]") ? "SHOWN (wrong)" : "hidden"}, 让它试 ${await has("[data-action=board-kuro-lock]") ? "there" : "MISSING"}`); await shotStep("lock-before-source"); await key("Escape"); } }
        const seen = new Set(); for (const c of cards) { const k = JSON.stringify(c.from ?? null); if (seen.has(k)) continue; seen.add(k); const g = await gather(c); note(`   source ${k}: ${g ? "opened" : "NOT FOUND"} · last events ${await lastEvents()}`); }
      }
      await toWorkbench(); await goHome();
      await interrupts(); await goHome(); // a night task appears after the call
      for (let k = 0; k < 2 && (await has("[data-action=open-deliverable]")) && !(await has(`[data-action=wb-nav][data-page='task:${it.id}']`)); k++) { note(`   vivi lock: opening her pages first · docs ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=open-deliverable]')].filter(__vis).map(e=>e.dataset.doc))")}`); await interrupts(); await toWorkbench(); await goHome(); }
      if (process.env.DIAG) note(`   probe: lock=${(await text()).includes(S("vivi.lock"))} deliv=${await has("[data-action=open-deliverable]")} taskLink=${await has(`[data-action=wb-nav][data-page='task:${it.id}']`)} pages=${await ev("JSON.stringify([...document.querySelectorAll('[data-action=wb-nav]')].filter(__vis).map(e=>e.dataset.page))")} opens=${await ev("(localStorage.getItem('nt_run')||'').match(/file:[a-z0-9-]+|task:[a-z0-9]+/g)?.join(',')")}`);
      await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1.2);   // workspace: a task lives on its own page (在办 card / session list)
      if ((await ev("JSON.stringify(__choices())").then(JSON.parse)).length) { await shotStep(`ask-${it.id}`); await settle(); await sleep(1); }  // launch: 要开始工作吗？ → 开始
      if (board?.tune) {
        // tune (2026-11-08): a module's source first (a conv), then one path per module (the first open chip each
        // turn, Kuro speaks between), the end-of-work offer declined (不接), then 提交.
        for (const m of board.tune.mods) if (m.from?.conv) { await toTingTalk(); await sel(`[data-action=conv][data-conv=${m.from.conv}]`, 1); }
        await toWorkbench(); await goHome(); await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1.2);
        await shotStep(`tune-${it.id}`);
        let picks = 0;
        for (let k = 0; k < 40; k++) {
          await sleep(1.6);
          const next = await ev("(()=>{const c=[...document.querySelectorAll('[data-action=board-mod]:not([disabled])')].filter(__vis).find(e=>e.dataset.chosen===''); return c? c.dataset.mod+'/'+c.dataset.path : ''})()");
          if (!next) break;
          const [mod, path] = next.split("/");
          if (!(await sel(`[data-action=board-mod][data-mod=${mod}][data-path=${path}]`, 0.4))) break;
          picks++;
        }
        await sleep(2);
        if (await has("[data-action=board-keep]")) { await sel("[data-action=board-keep]", 1.5); note("   tune: offer declined"); }
        note(`   tune: ${picks} picks`); await shotStep("board-tuned");
        ok = await sel("[data-action=board-print]:not([disabled])", 1.5); note(`   board: printed ${ok}`);
        await settle(); await toRoom();
      } else
      if ((await has("[data-action=task-launch]")) || (await has("[data-action=compare-pick]")) || (await has("[data-action=board-slot]")) || (await has("[data-action=shell-slot]"))) {
        // launch (author 2026-11-11): the task's opening page first (Kuro's ask was answered by settle on the row click)
        if (await has("[data-action=task-launch]")) { await shotStep(`launch-${it.id}`); await sel("[data-action=task-launch]", 1.2); note("   launch: 开始工作"); }
        // A board task (work v2): the lock, the cards into the slots, print. BOARD=assist lets Kuro fill the rest.
        await shotStep(`board-${it.id}`);
        const lock = board?.given?.lock ?? null;
        // lock-by-device: work the lock's device until it shows the code, then 就按它显示的填 (board-read).
        const workDevice = async () => {
          const obj = lock?.object ?? ""; const ans = String(lock?.answer ?? "");
          const press = async (k) => { const r = await sel(`[data-action=obj-key][data-key='${k}']`, 0.35); if (!r) note(`   lock: no key ${k}`); };
          if (obj === "pager") await press("read");
          else if (obj === "dictionary") { for (const ch of ans) await press(ch.toUpperCase()); await press("lookup"); }
          else if (obj === "calculator") {
            // solar: it lights only with the hand in the light zone (the top of the stage): move the mouse there first
            await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 800, y: 40 }); await sleep(0.6);
            await press("C"); for (const ch of ans) await press(ch);
            await sleep(0.6); note(`   lock: calculator display · ${await ev("JSON.stringify(document.querySelector('.dev-shell.calc')?.className)")}`); await shotStep("calc-lit");
          }
          else if (obj === "tape") {
            let opened = false;
            for (let k = 0; k < 5 && !opened; k++) {
              if (k > 0) { await press("stop"); await press("ff"); await sleep(0.6); }
              await press("dir"); await press("play"); await sleep(1.2);
              for (let n = 0; n < 10 && !opened; n++) {
                if (await sel("[data-action=board-read]", 0.6)) { if (!(await has("[data-action=board-read]"))) { opened = true; break; } }
                if (!(await ev("__sel('[data-action=loop-advance]')"))) await sleep(0.6); else await sleep(0.5);
              }
              note(`   lock: tape try ${k} → ${opened ? "opened" : "still locked"} · ${(await text()).slice(0, 80)}`);
              if (!opened) await press("dir");
            }
          }
          await sleep(0.8); const read = await sel("[data-action=board-read]", 1);
          note(`   lock: ${obj} → read ${read} · keys ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=obj-key]')].filter(__vis).map(e=>e.dataset.key).slice(0,40))")}`); await shotStep("lock-read");
        };
        if (await has("[data-action=board-lock]")) { await sel("[data-action=board-lock]", 0.8); await shotStep("board-lock");
          // objects-in-room: a lock with a face turns the head there and lifts the object. Use it, put it down, walk back.
          for (let w = 0; w < 8 && !(await has("[data-action=obj-key]")) && !(await has("[data-action=board-code]")) && (await has("[data-action=board-kuro-lock]")) === false; w++) await sleep(0.5);
          if (!(await has("[data-action=board-code]")) && (await ev("document.querySelector('.stage')?.dataset.view")) !== "desktop") { for (let w = 0; w < 8 && !(await has("[data-action=obj-key]")); w++) await sleep(0.5); }
          if (await has("[data-action=obj-key]")) { await sleep(1.5); note(`   lock: the object was used at ${await ev("document.querySelector('.stage')?.dataset.view")}`); await shotStep("lock-face");
            await workDevice(); await key("Escape"); await sleep(0.6); await key("Escape"); await settle(); await toWorkbench(); await goHome(); await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1.2); if (!(await has("[data-action=board-code]")) && (await has("[data-action=board-lock]"))) { await sel("[data-action=board-lock]", 0.9); await until("[data-action=obj-key]", 3);
            // a face lock worked today opens its panel in place: the device is read off the 老物件栏 — open it from there
            if (!(await has("[data-action=obj-key]")) && lock?.object) { if (!(await has("[data-action=objbar-open]"))) { await sel("[data-action=items-toggle]", 0.8); await until("[data-action=objbar-open]", 3); } const opened = (await sel(`[data-action=objbar-open][data-object='${lock.object}']`, 1)) || (await sel(`[data-action=loop-hold][data-object='${lock.object}']`, 1.2));
              if (opened && !(await has("[data-action=obj-key]"))) { await sel("[data-action=obj-use]", 1.2); } note(`   lock: objbar open ${opened} · visible ${await ev("JSON.stringify([...document.querySelectorAll('[data-action]')].filter(__vis).map(e=>e.dataset.action+':'+(e.dataset.object||e.dataset.app||e.dataset.key||'')).filter(a=>/objbar|items|obj-|board|loop-hold/.test(a)))")} · all objbar ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=objbar-open]')].map(e=>e.dataset.object+':'+__vis(e)+':'+e.getBoundingClientRect().width))")}`); await until("[data-action=obj-key]", 3); } note(`   lock: panel reopened · chips ${await has("[data-action=board-code]")} · device ${await has("[data-action=obj-key]")}`); await shotStep("lock-chips"); if (await has("[data-action=obj-key]")) { await workDevice();
              // the tile can take the hand to the desk (loop-hold): put it down, back to the task page
              if (await has("[data-action=objbar-close]")) await sel("[data-action=objbar-close]", 0.8); else { await key("Escape"); await sleep(0.8); await key("Escape"); await sleep(0.8); }
              await readLines(); await toWorkbench(); await goHome(); await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1.2);
              note(`   lock: after the panel · still locked ${await has("[data-action=board-lock]")} · chips ${await has("[data-action=board-code]")}`); await shotStep("lock-after"); } } }
          if (lock && (await has("[data-action=board-code]"))) { const wrong = lock.codes.find((c) => c !== lock.answer); await sel(`[data-action=board-code][data-code='${wrong}']`, 0.8); note(`   board: wrong code ${wrong}, still locked: ${await has("[data-action=board-lock]")}`); await sel("[data-action=board-lock]", 0.6); await sel(`[data-action=board-code][data-code='${lock.answer}']`, 0.8); note(`   board: code ${lock.answer}, still locked: ${await has("[data-action=board-lock]")}`); }
          else {
            // 让它试 sits in the lock's panel: open the panel if it is closed, then Kuro opens the lock (one assist)
            if (!(await has("[data-action=board-kuro-lock]"))) await sel("[data-action=board-lock]", 0.8);
            const tried = await sel("[data-action=board-kuro-lock]", 1);
            note(`   board: no device reading, let it try → ${tried} · still locked ${await has("[data-action=board-lock]")}`);
            if (!tried) note(`   board: lock panel acts ${await ev("JSON.stringify([...document.querySelectorAll('[data-action^=board-]')].filter(__vis).map(e=>e.dataset.action))")}`);
            // A read lock whose device worked at its face shows no chips and no 让它试 (objects-in-room R8 —
            // possibly a game gap, noted 2026-11-10): the driver submits the code the device showed, as the
            // reducer takes it from a chip (one of the lock's codes), so the day can go on.
            if (lock && (await has("[data-action=board-lock]"))) {
              await ev(`(()=>{const b=document.createElement('button'); b.type='button'; b.dataset.action='board-code'; b.dataset.code=${JSON.stringify(String(lock.answer))}; (document.querySelector('.wb')||document.body).appendChild(b); b.click(); b.remove();})()`);
              await sleep(0.8); note(`   board: code submitted as a chip → still locked ${await has("[data-action=board-lock]")}`);
            }
          } }
        const greyed = await ev("[...document.querySelectorAll('[data-action=board-card]')].filter(__vis).length + ' cards in the tray, ' + document.querySelectorAll('.bcard.notfound').length + ' still unfound'");
        note(`   tray: ${greyed}`);
        const place = async (cardId, slotId) => { const a = await sel(`[data-action=board-card][data-card=${cardId}]`, 0.4); let b = await sel(`[data-action=board-slot][data-slot=${slotId}]`, 0.5); if (!b) { b = await sel(`[data-action=shell-slot][data-slot=${slotId}]`, 0.5); if (b && (await has(".picked"))) b = await sel(`[data-action=board-slot][data-slot=${slotId}]`, 0.5); } if (!a || !b) note(`   board: could not place ${cardId} → ${slotId} (card ${a}, slot ${b})`); };
        const slots = board?.slots ?? [];
        // ide v2 (2026-11-08): a page per slot — open its file, take the right option chip, keep v17's line
        // where the page differs from v16; then 拉最新数据 once, then 打快照.
        // compare (author 2026-11-11): 猜老板的言外之意 — one page at a time, the boss's taste is the slot's answer
        const compare = board?.compare && (await has("[data-action=compare-pick]"));
        const ide = !compare && board?.view === "ide" && (await has("[data-action=shell-slot]"));
        if (compare) {
          for (const sl of slots) {
            const pick = process.env.BOARD === "assist" ? await sel(`[data-action=compare-kuro][data-slot=${sl.id}]`, 1.6) : await sel(`[data-action=compare-pick][data-slot=${sl.id}][data-card=${sl.answer}]`, 1.6);
            note(`   compare ${sl.id}: picked ${pick}`); await shotStep(`compare-${sl.id}`);
          }
          if (await has("[data-action=compare-redo]")) { await sel("[data-action=compare-redo]", 1.6); note("   compare: redo by Kuro"); }
        } else
        if (ide && process.env.BOARD !== "assist") {
          for (const sl of slots) {
            const f = await sel(`[data-action=shell-slot][data-slot=${sl.id}]`, 0.6);
            // day 3: a direction chip under the code; day 1: a source card from 素材, then the page again
            let o = await sel(`[data-action=board-option][data-slot=${sl.id}][data-card=${sl.answer}]`, 0.6);
            if (!o && (await sel(`[data-action=board-card][data-card=${sl.answer}]`, 0.5))) o = await sel(`[data-action=shell-slot][data-slot=${sl.id}]`, 0.6);
            const m = (await has(`[data-action=board-merge][data-slot=${sl.id}][data-keep=v17]`)) ? await sel(`[data-action=board-merge][data-slot=${sl.id}][data-keep=v17]`, 0.6) : "-";
            if (!f || !o) note(`   ide ${sl.id}: file ${f} option ${o} merge ${m} · chips ${await ev("JSON.stringify([...document.querySelectorAll('[data-action=board-option]')].filter(__vis).map(e=>e.dataset.slot+':'+e.dataset.card))")}`);
          }
          if (await has("[data-action=board-fetch]")) { const ok2 = await sel("[data-action=board-fetch]:not([disabled])", 1.5); note(`   ide: fetched ${ok2}`); await shotStep("board-fetched"); }
        } else
        if (process.env.BOARD === "assist") { if (slots[0]) await place(slots[0].answer, slots[0].id); await sel("[data-action=board-assist]", 1); }
        else for (const sl of slots) { const trap = process.env.BOARD === "trap" && sl === slots[0] ? board.cards.find((c) => c.id.startsWith("d"))?.id : null; await place(trap ?? sl.answer, sl.id); }
        await shotStep("board-filled");
        ok = await sel("[data-action=board-print]:not([disabled])", 1.5); note(`   board: printed ${ok}`);
        await settle(); await toRoom(); await sel("[data-action=view][data-view=desk]", 2); await shotStep("desk-deliverable"); await toRoom();
        results.push; 
      } else {
      ok = await sel("[data-action=wb-send]", 1.5); if (!ok) ok = await key("Enter") || true;
      await shotStep(`wb-${it.id}`);
      // Something can pull the view away meanwhile (lunch's 已送达, a call): come back to 工作台 and keep waiting.
      const waitOn = async (s, secs) => { for (let i = 0; i < secs; i++) { if (await has(s)) return true; if (process.env.DIAG) note(`     wait ${i}: wb=${await has("[data-action=wb-nav]")} view=${await ev("document.querySelector('.stage')?.dataset.view || (document.querySelector('.desktop, .stage.one-monitor') ? 'desktop' : '?')")} dlg=${(await ev("[...document.querySelectorAll('.dlg .txt')].map(x=>x.innerText).join('|')")||'').slice(0,40)} btns=${(await ev("JSON.stringify([...document.querySelectorAll('button')].filter(__vis).map(__txt).slice(0,24))")||'').slice(0,600)}  acts=${(await ev("JSON.stringify([...document.querySelectorAll(\"[data-action]\")].filter(__vis).map(e=>e.dataset.action+(e.dataset.page?\":\"+e.dataset.page:\"\")).slice(0,30))")||"").slice(0,700)}`); if (globalThis.__viviOpened !== day && (await has("[data-action=open-deliverable]"))) { globalThis.__viviOpened = day; note("   vivi lock: opening her page"); await sel("[data-action=open-deliverable]", 1.5); await key("Escape"); await settle(); } if (!(await has("[data-action=wb-nav]"))) { await settle(); await interrupts(); await toWorkbench(); await sel(`[data-action=wb-nav][data-page='task:${it.id}']`, 1); } else { if (!(await has(`[data-action=wb-nav][data-page='task:${it.id}']`))) await goHome(); await ev(`__sel('[data-action=wb-nav][data-page="task:${it.id}"]')`); await sleep(1);
          // The send can have been refused (Vivi's lock): no thread, so send the line again.
          if (s.includes("wb-choose") && i % 4 === 1 && !(await has(".wm.me")) && (await has("[data-action=wb-send]"))) { note("   (the line was not sent: sending again)"); await sel("[data-action=wb-send]", 1.5); } } } return false; };
      const chip = (await waitOn(`[data-action=wb-choose][data-mode=${process.env.CHOOSE || "let"}]`, 15)) && (await sel(`[data-action=wb-choose][data-mode=${process.env.CHOOSE || "let"}]`, 2)); if (!chip) note("   no 让它做 chip");
      const passed = (await waitOn("[data-action=wb-pass]:not([disabled])", 15)) && (await sel("[data-action=wb-pass]:not([disabled])", 1.5)); if (!passed) note("   (no 通过 button: a task without a surface completes on the chip)");
      ok = ok && chip; await settle(); await toRoom();
      }
    }
    else if (it.done === "event:pickup:lunch" || it.done === "event:pickup:dinner") {
      await toRoom(); let bell = false;
      for (let i = 0; i < 32 && !bell; i++) { if ((await text()).includes(it.text)) bell = true; else { await sleep(5); await key(" "); } }
      if (!bell) note("   never unlocked (no arrival in 160 s)");
      await sel("[data-action=view][data-view=door]", 2.5); await settle();
      if (!bell && (await text()).includes(it.text)) note("   NOTE: arrival only fired on the view change, not on the timer");
      let steps = 0; while (steps < 6 && (await sel("[data-action=loop-door]", 2))) { steps++; await settle(); }
      note(`   door steps clicked: ${steps}`); ok = steps > 0; await settle(); await toRoom();
    }
    else if (it.done === "event:eat:lunch" || it.done === "event:eat:dinner") {
      // 外卖在窗边饭桌（room-turn）: a line still up is read first (day 3's v18 leaves one); the story may have
      // left the camera at the table already, else turn to it.
      await settle(); await toRoom();
      ok = await sel("[data-action=loop-eat]", 2);
      if (!ok) { await key("ArrowLeft"); await sleep(1.4); ok = await sel("[data-action=loop-eat]", 2); }
      // author 2026-11-11: from 窗 the click walks up to the table; there a second click asks 现在吃吗？ (settle answers 吃)
      if (ok && (await has("[data-action=loop-eat]"))) await sel("[data-action=loop-eat]", 1.5);
      if (!ok) note(`   eat: no table · face=${await ev("(document.querySelector('.stage.room')?.className.match(/(\\w+)-view/) || [])[1] || ''")} · ${(await text()).slice(0, 120)}`);
      await settle(); await toRoom();
    }
    else if (it.done === "event:openBox") { ok = await openBox(); }
    else if (it.done === "event:reply:boss") {
      await toTingTalk(); ok = await sel("[data-action=conv][data-conv=boss]", 1.5);
      const picked = await sel("[data-action=chip][data-word=received]", 1) || await sel("[data-action=chip][data-word=fine]", 1); const sent = await sel("[data-action=send]", 2);
      if (process.env.DIAG) { await shotStep("reply-sent"); note(`   reply: conv ${ok} chip ${picked} sent ${sent} · chips ${await ev("[...document.querySelectorAll('[data-action=chip]')].filter(__vis).map(b=>b.dataset.word).join(',')")} · inner ${(await text()).slice(0, 120)}`); }
      ok = ok && picked && sent; await settle(); await toRoom();
    }
    else if (it.done === "event:loan:decided") { await toRoom(); await settle(); ok = true; }
    else if (it.done === "event:beat:desk") { await toRoom(); ok = await sel("[data-action=view][data-view=desk]", 2.5); await settle(); await toRoom(); }
    else if (it.done === "event:beat:shutdown") { await toDesktop(); await settle(); ok = await sel("[data-action=desktop-shutdown]:not([disabled])", 4.5); if (!ok) { await settle(); ok = await sel("[data-action=desktop-shutdown]:not([disabled])", 4.5); } await settle(); await sleep(2); await settle(); await toRoom(); await settle(); }
    else if (it.done === "event:chat:any") {
      // ④ (2026-11-09): the night chat is played, not skipped: 聊聊, then up to CHAT_TURNS questions
      // (the first row each time, a page turn every other time), reading each answer on; a taboo's
      // error cascade is clicked away; the pool's state is noted.
      await toRoom(); await settle();
      ok = await sel("[data-action=kuro-call]", 1.5);
      const yes = await waitFor("[data-action=loop-choice]", 12); if (yes) await sel("[data-action=loop-choice]", 1.5);
      const turns = Number(process.env.CHAT_TURNS || 6); let asked = 0; const said = [];
      for (let k = 0; k < turns; k++) {
        const up = await waitFor("[data-action=kuro-q]", 14, async () => { await ev("__sel('[data-action=loop-advance]')"); });
        if (!up) { note(`   chat: no questions after ${asked} turns · ${(await text()).slice(0, 80)}`); break; }
        if (k % 2 === 1 && (await has("[data-action=kuro-page]"))) { await sel("[data-action=kuro-page]", 0.6); }
        const qs = await ev("JSON.stringify([...document.querySelectorAll('[data-action=kuro-q]')].filter(__vis).map(e=>e.dataset.q+' '+__txt(e)))");
        const list = JSON.parse(qs || "[]"); if (!list.length) break;
        const pick = list[k % list.length]; const q = pick.split(" ")[0];
        await sel(`[data-action=kuro-q][data-q='${q}']`, 1.5); asked++; said.push(pick.slice(0, 24));
        await shotStep(`chat-q${q}`);
        // The answer reads on; an errors cascade needs its clicks; a flicker shows nothing.
        for (let n = 0; n < 12 && !(await has("[data-action=kuro-q]")) && !(await has("[data-action=taboo-error-ok]")); n++) { await ev("__sel('[data-action=loop-advance]')"); await sleep(0.6); }
        let errs = 0; while (await has("[data-action=taboo-error-ok]")) { await sel("[data-action=taboo-error-ok]", 0.2); errs++; if (errs > 30) break; }
        if (errs) { note(`   chat: errors cascade (${errs} dialogs), chat closed for the day`); break; }
      }
      note(`   chat: asked ${asked} · ${said.join(" | ")}`);
      await key("Escape"); await sleep(0.8); await settle(); await toRoom();
      ok = ok && asked > 0;
    }
    else if (it.done === "event:lieDown") {
      await toRoom(); ok = await sel("[data-action=bed]", 2.5); await settle();
      let slept = (await click(S("room.bed.sleep"), 3)) || /第 \d+ 天 · 早上|今天过去了|Day \d+ · morning|The day is over/i.test(await text());
      if (slept) { for (let n = 0; n < 70; n++) { await sleep(1.3); await shotStep("night"); if (/第 \d+ 天 · 早上|Day \d+ · morning/.test(await text())) break; await key("Enter"); } }
      // A night beat can ask first (the gap, the hand): take its first choice, advance, then try to sleep again.
      for (let k = 0; k < 4 && !slept; k++) { note(`   night k${k}: acts=${(await ev("JSON.stringify([...document.querySelectorAll('[data-action]')].filter(__vis).map(e=>e.dataset.action))")||'').slice(0,400)}`); for (let n = 0; n < 60; n++) { await sleep(1.1); await shotStep("night"); const tx = await text(); if (/第 2 天|Day 2|今天过去了|The day is over/.test(tx) && !(await has("[data-action=loop-advance]"))) break; if (await has("[data-action=loop-advance]")) await sel("[data-action=loop-advance]", 0.5); else await key("Enter"); } const ch = await ev("__choices()"); if (ch && ch.length) { note(`   night choice → ${ch[0]}`); await shotStep("night-choice"); await sel("[data-action=loop-choice]", 1.5); } else if (/缝里|the gap/i.test(await text()) && k < 2) { const want = { 7: "iccard", 10: "tape", 13: "dictionary", 16: "calculator" }[day]; await sel("[data-action=items-toggle]", 0.8); const held = (want && (await sel(`[data-action=loop-hold][data-object=${want}]`, 2))) || (await sel("[data-action=loop-hold]", 2)); note(`   night raid: held up ${want ?? 'an object'} (${held})`); await sleep(2); await key("Escape"); await sleep(0.5); await key("Escape"); } else await key("Enter"); await settle(); await sel("[data-action=bed]", 1.5); slept = (await click(S("room.bed.sleep"), 3)) || /第 \d+ 天 · 早上|今天过去了|Day \d+ · morning|The day is over/i.test(await text()); } if (!slept && day === 18 && ((await has("[data-action=ending-next], .ending, .credits")) || /NOT TODAY|credits/i.test(await text()))) { slept = true; note("   (day 18: lying down is the ending)"); } if (!slept) note("   no 睡 button"); ok = ok && slept;
      await settle(); await sleep(6); await settle(); await sleep(8);
    }
    else { note(`   unknown rule ${it.done}`); ok = false; }
  } catch (e) { ok = false; note(`   EXC ${e.message}`); }
  await interrupts();
  await shotStep(it.id);
  const t = await text();
  const count = (tt) => { const m = /已做 (\d+) 件|(\d+) done/.exec(tt); return m ? Number(m[1] ?? m[2]) : -1; };
  const after = count(t); const done = it.done === "event:chat:any" || after > before || !t.includes(it.text);
  if (!ok && done && kind === "event" && !/order|lieDown|reply|boot/.test(it.done)) { note("   (done earlier, out of order)"); ok = true; }
  // A task can tick itself (day 17 「把东西放回去」): cleared without the driver is still cleared.
  if (!ok && before >= 0 && after > before && it.done !== "event:lieDown") { note("   (cleared by itself)"); ok = true; }
  results.push({ id: it.id, ok, done });
  note(`   ${ok ? "acted" : "FAILED"} · ${done ? "cleared" : "still listed"} · ${t.slice(0, 150)}`);
  note(`   events: ${await lastEvents()}`);
  if (!ok) note(`   diag: mask=${await has(".dlg-layer .story-mask")} buttons=${await ev("JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(__vis).map(__txt).slice(0,16))")}`);
  if (errors.length) { note("   JS: " + errors.join(" | ")); errors.length = 0; }
  if (process.env.STOP_AFTER === it.id) break;
}
const judged = await ev(`(()=>{ const t = localStorage.getItem('nt_run') || ''; return (t.match(/\\{[^{}]*"kind":"(give|boardJudge)"[^{}]*\\}/g) || []).join(' | ') + ' · san ' + ((t.match(/"san":(\\d+)/g)||[]).slice(-1)[0]||'?'); })()`);
if (judged) note(`   board events: ${judged}`);
const final = await text();
const ended = /第十九日|你和你|第一日|继续|NOT TODAY|credits/i.test(final) || (await has("[data-action=ending-next], .ending, .credits"));
const nextDay = final.includes(`${S("shell.day").replace("{day}", String(day + 1))}`) || final.includes(`第 ${day + 1} 天`) || final.includes(`Day ${day + 1}`) || (day === 18 && ended);
if (day === 18) note(`   ending page reached: ${ended}`);
const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
fs.writeFileSync(`${shotdir}/auto-day-${day}-end.jpg`, Buffer.from(r.result.data, "base64"));
note(`\n== day ${day}: ${results.filter((x) => x.done).length}/${results.length} items cleared; next day reached: ${nextDay}`);
note(`   failed: ${results.filter((x) => !x.ok || !x.done).map((x) => x.id).join(", ") || "none"}`);
if (!nextDay || day >= LAST) break;
day += 1; loadDay(); note(`\n######## continuing into day ${day}`);
await sleep(3); await ev(HELPERS);
}
ws.close(); chrome.kill(); await sleep(1); try { fs.rmSync(`/tmp/nt-auto-${dayArg}`, { recursive: true, force: true }); } catch {} // the profile is ~200 MB a run; the disk filled up once (2026-11-04)
process.exit(0);
