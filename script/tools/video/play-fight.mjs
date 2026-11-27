// Plays the day-18 fight and the pages after it at a pace a viewer can follow.
const NAMES = process.env.LANG_ === "en" ? { login: "Robin", nick: "sweetpea", calledBy: "chief", bossCalls: "rockstar", pronoun: "she", portrait: "p1" } : { login: "苏禾", nick: "宝宝", calledBy: "姐", bossCalls: "同学", pronoun: "she", portrait: "p1" };
export default async function ({ ev, sleep, mark, has, click }) {
  let move = 0, last = "", pages = [], idle = 0;
  for (let i = 0; i < 2000; i++) {
    const page = await ev("(()=>{const p=document.querySelector('.ending-page'); if(!p) return ''; const c=[...p.classList].find(x=>/-page$|^first-day$|^day-19$/.test(x))||''; return c+(p.dataset.step?'-'+p.dataset.step:'')+(p.classList.contains('carded')?'-card':'')})()");
    if (page) {
      if (pages[pages.length - 1] !== page) { pages.push(page); mark("page " + page + " · " + (await ev("(document.querySelector('.ending-page').innerText||'').replace(/\\s+/g,' ').slice(0,80)"))); }
      if (/^(first-day|day-19)/.test(page)) { await sleep(4); break; }
      await sleep(Number(process.env.PAGE_DWELL) || 4.5);
      if (!(await click("[data-action=ending-next]"))) { idle++; if (idle > 8) { mark("no ending-next: stop"); break; } } else idle = 0;
      await sleep(0.8); continue;
    }
    if (await has("[data-action=boss-move]")) {
      const n = await ev("[...document.querySelectorAll('[data-action=boss-move]')].filter(e=>e.getClientRects().length>0).map(e=>e.innerText.replace(/\\s+/g,' ').trim())");
      await sleep(0.9); const pick = move++ % n.length; mark("move " + n[pick] + " of " + n.join(" | ")); await click("[data-action=boss-move]", pick); await sleep(0.5); continue;
    }
    for (const a of ["boss-next", "boss-retry", "boss-done"]) if (await has(`[data-action=${a}]`)) {
      const txt = await ev("(document.querySelector('.bs-box')?.innerText||'').replace(/\\s+/g,' ').slice(0,90)");
      if (txt !== last) { last = txt; mark(a + " · " + txt); await sleep(Number(process.env.LINE_DWELL) || 1.5); }
      await click(`[data-action=${a}]`); await sleep(0.35); idle = 0; break;
    }
    await sleep(0.25); if (++idle > 240) { mark("idle 60 s: stop"); break; }
  }
  mark("pages: " + pages.join(" → "));
}
