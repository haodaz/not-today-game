// Presses a story through at reading pace: one mark per line, choices answered with the first option (or CHOOSE=<text>).
export default async function ({ ev, sleep, mark, has, click, send }) {
  const NAMES = process.env.LANG_ === "en" ? { login: "Robin", nick: "sweetpea", calledBy: "chief", bossCalls: "rockstar", pronoun: "she", portrait: "p1" } : { login: "苏禾", nick: "宝宝", calledBy: "姐", bossCalls: "同学", pronoun: "she", portrait: "p1" };
  const max = Number(process.env.LINES) || 400, rate = process.env.LANG_ === "en" ? 0.028 : 0.07; let n = 0, idle = 0, last = "";
  const key = async (k) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: k === " " ? 32 : 0 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: k === " " ? 32 : 0 }); };
  while (n < max) {
    const choices = await ev("[...document.querySelectorAll('[data-action=loop-choice]')].filter(e=>e.getClientRects().length>0).map(e=>e.innerText.replace(/\\s+/g,' ').trim())");
    if (choices && choices.length) { await sleep(1.6); const want = process.env.CHOOSE ? choices.findIndex((c) => c.includes(process.env.CHOOSE)) : 0; mark("choice " + choices.join(" | ")); await click("[data-action=loop-choice]", Math.max(0, want)); await sleep(0.6); idle = 0; continue; }
    const txt = (await ev("[...document.querySelectorAll('.dlg .txt, .dlg-layer .txt')].filter(e=>e.getClientRects().length>0).map(x=>x.innerText).join(' | ').replace(/\\s+/g,' ')")) || "";
    if (await has(".dlg-layer .story-mask")) {
      if (txt !== last) { last = txt; n++; mark(txt.slice(0, 110)); await sleep(Math.min(4.2, Math.max(1.3, 0.9 + txt.length * rate)) * (Number(process.env.SLOW) || 1)); }
      await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.45); idle = 0; continue;
    }
    if (txt && txt !== last) { last = txt; n++; mark("(box) " + txt.slice(0, 110)); await sleep(Math.min(4.2, Math.max(1.3, 0.9 + txt.length * rate))); await key(" "); await sleep(0.45); idle = 0; continue; }
    await sleep(0.5); if (++idle > (Number(process.env.IDLE) || 12)) { mark("quiet: stop"); break; }
    if (idle % 4 === 0) await key(" ");
  }
}
